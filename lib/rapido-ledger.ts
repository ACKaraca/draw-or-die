import { createHash } from 'crypto';

import { Query } from 'node-appwrite';

import { isAppwriteConflict, isAppwriteNotFound } from '@/lib/appwrite/error-utils';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_RAPIDO_LEDGER_ID,
  getAdminTables,
  type RapidoLedgerEntryRow,
} from '@/lib/appwrite/server';
import { logServerError } from '@/lib/logger';

import type { RapidoBalanceCounter } from '@/lib/rapido-balance';

// Append-only Rapido journal (DOD-23).
//
// - Every economic transition is a NEW immutable entry. Nothing here updates or deletes an entry.
// - Entry row ids are deterministic per (user, operation, slot), so the database's unique primary
//   key is the idempotency guard: one reserve and ONE close (settle | void) per operation, ever.
// - The legacy profile counter (`rapido_pens` + `rapido_fraction_cents`) stays the authoritative
//   balance during the shadow phase; `deltaCents` of every entry mirrors the counter mutation so
//   `sum(deltaCents)` must reconcile with it (see `reconcileShadowProjection`).
// - Value buckets (allowance / purchased / ...) live only in the journal and are derived by a
//   deterministic replay (`projectBalance`), so purchased value stays attributable through
//   spend, refund and expiry without a mutable per-bucket counter.
// - Write order rule: when the counter is CREDITED, the entry is appended first (the entry is the
//   idempotency guard, a crash can only under-credit); when it is DEBITED, the debit happens first
//   (a crash can only leave an un-journaled debit). Both directions are detected by reconciliation
//   and neither can mint value.

export const RAPIDO_LEDGER_ENTRY_KINDS = [
  'opening',
  'grant',
  'purchase',
  'reserve',
  'settle',
  'void',
  'expiry',
  'refund',
  'correction',
] as const;
export type RapidoLedgerEntryKind = (typeof RAPIDO_LEDGER_ENTRY_KINDS)[number];

/** Also the spend order: allowance is consumed first, purchased value last. */
export const RAPIDO_VALUE_BUCKETS = ['allowance', 'promotional', 'earned', 'legacy', 'purchased'] as const;
export type RapidoValueBucket = (typeof RAPIDO_VALUE_BUCKETS)[number];

export const RAPIDO_LEDGER_SYSTEM_ACTOR = 'system';
export const DEFAULT_RESERVATION_LEASE_MS = 10 * 60 * 1000;

const OPERATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const ENTRY_ID_LENGTH = 36;
const LIST_PAGE_SIZE = 500;
const MAX_LIST_PAGES = 40;
const KIND_REPLAY_ORDER: Record<RapidoLedgerEntryKind, number> = {
  opening: 0,
  grant: 1,
  purchase: 1,
  correction: 1,
  reserve: 2,
  settle: 3,
  void: 3,
  refund: 4,
  expiry: 5,
};

export type RapidoLedgerEntry = {
  entryId: string;
  userId: string;
  /** Operation / source id: AI operation id, Stripe event id, correction id, 'opening'. */
  operationId: string;
  kind: RapidoLedgerEntryKind;
  /** Signed effect on the available (counter) balance. */
  deltaCents: number;
  /** Non-negative magnitude: reserved, charged, voided, expired, refunded or corrected amount. */
  amountCents: number;
  /** Bucket credited/debited for opening, grant, purchase, expiry and correction entries. */
  bucket: RapidoValueBucket | null;
  reason: string;
  actor: string;
  approvedBy: string | null;
  /** AI operation name (SINGLE_JURY, ...) for reserve/settle/void. */
  operation: string | null;
  /** Reserve entries only: after this instant an open reservation may be voided by a sweeper. */
  leaseExpiresAt: string | null;
  occurredAt: string;
};

export type RapidoLedgerStore = {
  /** Create-only. Must report `duplicate` (never overwrite) when the entry id already exists. */
  appendEntry(entry: RapidoLedgerEntry): Promise<'appended' | 'duplicate'>;
  getEntry(entryId: string): Promise<RapidoLedgerEntry | null>;
  listEntries(userId: string): Promise<RapidoLedgerEntry[]>;
};

export type RapidoLedgerDeps = {
  store: RapidoLedgerStore;
  counter: RapidoBalanceCounter;
  now?: () => Date;
};

export class RapidoLedgerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RapidoLedgerError';
    this.code = code;
  }
}

// ----------------------------------------------------------------------------- ids & validation

export function isValidOperationId(value: unknown): value is string {
  return typeof value === 'string' && OPERATION_ID_PATTERN.test(value);
}

/** Deterministic Appwrite-safe row id (hex, 36 chars). Mirrored in scripts/rapido-ledger-backfill.mjs. */
export function ledgerEntryId(userId: string, operationId: string, slot: string): string {
  return createHash('sha256')
    .update(`${userId}|${operationId}|${slot}`)
    .digest('hex')
    .slice(0, ENTRY_ID_LENGTH);
}

function toCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function requireText(value: string, field: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) throw new RapidoLedgerError('INVALID_INPUT', `${field} is required`);
  return trimmed.slice(0, 256);
}

function buildEntry(
  deps: RapidoLedgerDeps,
  fields: Omit<RapidoLedgerEntry, 'entryId' | 'occurredAt' | 'approvedBy' | 'operation' | 'leaseExpiresAt' | 'bucket'> & {
    slot: string;
    bucket?: RapidoValueBucket | null;
    approvedBy?: string | null;
    operation?: string | null;
    leaseExpiresAt?: string | null;
  },
): RapidoLedgerEntry {
  const { slot, ...rest } = fields;
  return {
    ...rest,
    entryId: ledgerEntryId(fields.userId, fields.operationId, slot),
    bucket: fields.bucket ?? null,
    approvedBy: fields.approvedBy ?? null,
    operation: fields.operation ?? null,
    leaseExpiresAt: fields.leaseExpiresAt ?? null,
    occurredAt: (deps.now ? deps.now() : new Date()).toISOString(),
  };
}

// ----------------------------------------------------------------------------- operation state

export type RapidoOperationStatus =
  | { state: 'none' }
  | { state: 'open'; reserve: RapidoLedgerEntry }
  | { state: 'settled' | 'voided'; reserve: RapidoLedgerEntry; close: RapidoLedgerEntry };

export async function getOperationStatus(
  store: RapidoLedgerStore,
  userId: string,
  operationId: string,
): Promise<RapidoOperationStatus> {
  const [reserve, close] = await Promise.all([
    store.getEntry(ledgerEntryId(userId, operationId, 'reserve')),
    store.getEntry(ledgerEntryId(userId, operationId, 'close')),
  ]);
  if (!reserve) return { state: 'none' };
  if (!close) return { state: 'open', reserve };
  return { state: close.kind === 'settle' ? 'settled' : 'voided', reserve, close };
}

// ----------------------------------------------------------------------------- reserve / settle / void

export type ReserveResult =
  | { kind: 'reserved'; reservedCents: number; balanceCents: number | null }
  | { kind: 'insufficient' }
  | { kind: 'duplicate'; state: 'open' | 'settled' | 'voided' };

export async function reserve(
  deps: RapidoLedgerDeps,
  input: {
    userId: string;
    operationId: string;
    operation: string;
    amountCents: number;
    leaseMs?: number;
  },
): Promise<ReserveResult> {
  if (!isValidOperationId(input.operationId)) {
    throw new RapidoLedgerError('INVALID_OPERATION_ID', 'operationId is invalid');
  }
  const amount = toCents(input.amountCents);
  const existing = await getOperationStatus(deps.store, input.userId, input.operationId);
  if (existing.state !== 'none') return { kind: 'duplicate', state: existing.state };

  let balanceCents: number | null = null;
  if (amount > 0) {
    const debit = await deps.counter.debit(amount);
    if (!debit.ok) {
      // A concurrent twin may have taken the balance; report it as the duplicate it is.
      const raced = await getOperationStatus(deps.store, input.userId, input.operationId);
      return raced.state === 'none' ? { kind: 'insufficient' } : { kind: 'duplicate', state: raced.state };
    }
    balanceCents = debit.balanceCents;
  }

  const now = deps.now ? deps.now() : new Date();
  const entry = buildEntry(deps, {
    slot: 'reserve',
    userId: input.userId,
    operationId: input.operationId,
    kind: 'reserve',
    deltaCents: -amount,
    amountCents: amount,
    reason: 'ai_operation',
    actor: RAPIDO_LEDGER_SYSTEM_ACTOR,
    operation: input.operation,
    leaseExpiresAt: new Date(now.getTime() + (input.leaseMs ?? DEFAULT_RESERVATION_LEASE_MS)).toISOString(),
  });

  let appended: 'appended' | 'duplicate';
  try {
    appended = await deps.store.appendEntry(entry);
  } catch (error) {
    if (amount > 0) await deps.counter.credit(amount);
    throw error;
  }

  if (appended === 'duplicate') {
    // A concurrent request with the same operation id won the race; give our debit back.
    if (amount > 0) await deps.counter.credit(amount);
    const state = await getOperationStatus(deps.store, input.userId, input.operationId);
    return { kind: 'duplicate', state: state.state === 'none' ? 'open' : state.state };
  }

  return { kind: 'reserved', reservedCents: amount, balanceCents };
}

export type SettleResult =
  | { kind: 'settled'; chargedCents: number; shortfallCents: number; balanceCents: number | null }
  | { kind: 'insufficient'; requiredExtraCents: number }
  | { kind: 'already_closed'; state: 'settled' | 'voided' }
  | { kind: 'not_reserved' };

/**
 * Closes an open reservation as accepted. `actualCents` may differ from the reserved amount:
 * the remainder is released, or the extra is debited atomically. With `shortfall: 'reject'` an
 * unaffordable extra leaves the reservation open (the caller should void it); with `'clamp'` the
 * extra is charged up to what is available and never drives the balance negative.
 */
export async function settle(
  deps: RapidoLedgerDeps,
  input: {
    userId: string;
    operationId: string;
    actualCents: number;
    shortfall?: 'reject' | 'clamp';
  },
): Promise<SettleResult> {
  const status = await getOperationStatus(deps.store, input.userId, input.operationId);
  if (status.state === 'none') return { kind: 'not_reserved' };
  if (status.state !== 'open') return { kind: 'already_closed', state: status.state };

  const reservedCents = status.reserve.amountCents;
  const actualCents = toCents(input.actualCents);
  const requiredExtra = Math.max(0, actualCents - reservedCents);
  let extraCharged = 0;
  let balanceCents: number | null = null;

  if (requiredExtra > 0) {
    const debit = await deps.counter.debit(requiredExtra);
    if (debit.ok) {
      extraCharged = requiredExtra;
      balanceCents = debit.balanceCents;
    } else if ((input.shortfall ?? 'reject') === 'reject') {
      return { kind: 'insufficient', requiredExtraCents: requiredExtra };
    } else {
      const available = await deps.counter.read();
      const partial = Math.min(available, requiredExtra);
      if (partial > 0) {
        const partialDebit = await deps.counter.debit(partial);
        if (partialDebit.ok) {
          extraCharged = partial;
          balanceCents = partialDebit.balanceCents;
        }
      }
    }
  }

  const chargedCents = Math.min(actualCents, reservedCents) + extraCharged;
  const releaseCents = Math.max(0, reservedCents - chargedCents);
  const entry = buildEntry(deps, {
    slot: 'close',
    userId: input.userId,
    operationId: input.operationId,
    kind: 'settle',
    deltaCents: releaseCents - extraCharged,
    amountCents: chargedCents,
    reason: requiredExtra > extraCharged ? 'accepted_with_shortfall' : 'accepted',
    actor: RAPIDO_LEDGER_SYSTEM_ACTOR,
    operation: status.reserve.operation,
  });

  let appended: 'appended' | 'duplicate';
  try {
    appended = await deps.store.appendEntry(entry);
  } catch (error) {
    if (extraCharged > 0) await deps.counter.credit(extraCharged);
    throw error;
  }

  if (appended === 'duplicate') {
    if (extraCharged > 0) await deps.counter.credit(extraCharged);
    const closed = await getOperationStatus(deps.store, input.userId, input.operationId);
    return { kind: 'already_closed', state: closed.state === 'voided' ? 'voided' : 'settled' };
  }

  if (releaseCents > 0) {
    balanceCents = await creditAfterJournal(deps, entry, releaseCents);
  }

  return { kind: 'settled', chargedCents, shortfallCents: requiredExtra - extraCharged, balanceCents };
}

export type VoidResult =
  | { kind: 'voided'; releasedCents: number; balanceCents: number | null }
  | { kind: 'already_closed'; state: 'settled' | 'voided' }
  | { kind: 'not_reserved' };

/** Closes an open reservation with zero spend (failure, cancel, timeout, refusal, lease expiry). */
export async function voidReservation(
  deps: RapidoLedgerDeps,
  input: { userId: string; operationId: string; reason: string },
): Promise<VoidResult> {
  const status = await getOperationStatus(deps.store, input.userId, input.operationId);
  if (status.state === 'none') return { kind: 'not_reserved' };
  if (status.state !== 'open') return { kind: 'already_closed', state: status.state };

  const releasedCents = status.reserve.amountCents;
  const entry = buildEntry(deps, {
    slot: 'close',
    userId: input.userId,
    operationId: input.operationId,
    kind: 'void',
    deltaCents: releasedCents,
    amountCents: releasedCents,
    reason: requireText(input.reason, 'reason'),
    actor: RAPIDO_LEDGER_SYSTEM_ACTOR,
    operation: status.reserve.operation,
  });

  if ((await deps.store.appendEntry(entry)) === 'duplicate') {
    const closed = await getOperationStatus(deps.store, input.userId, input.operationId);
    return { kind: 'already_closed', state: closed.state === 'settled' ? 'settled' : 'voided' };
  }

  const balanceCents = releasedCents > 0 ? await creditAfterJournal(deps, entry, releasedCents) : null;
  return { kind: 'voided', releasedCents, balanceCents };
}

/** Voids reservations whose lease expired without a close entry (e.g. the function was killed). */
export async function voidExpiredReservations(
  deps: RapidoLedgerDeps,
  userId: string,
): Promise<string[]> {
  const nowMs = (deps.now ? deps.now() : new Date()).getTime();
  const entries = await deps.store.listEntries(userId);
  const closed = new Set(entries.filter((e) => e.kind === 'settle' || e.kind === 'void').map((e) => e.operationId));
  const voided: string[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'reserve' || closed.has(entry.operationId)) continue;
    if (!entry.leaseExpiresAt || Date.parse(entry.leaseExpiresAt) > nowMs) continue;
    const result = await voidReservation(deps, { userId, operationId: entry.operationId, reason: 'lease_expired' });
    if (result.kind === 'voided') voided.push(entry.operationId);
  }
  return voided;
}

async function creditAfterJournal(
  deps: RapidoLedgerDeps,
  entry: RapidoLedgerEntry,
  cents: number,
): Promise<number | null> {
  try {
    return await deps.counter.credit(cents);
  } catch (error) {
    // The journal already records the credit; reconciliation surfaces the counter drift.
    logServerError('rapido.ledger.counter_credit_failed', error, {
      userId: entry.userId,
      operationId: entry.operationId,
      kind: entry.kind,
      cents,
    });
    return null;
  }
}

// ----------------------------------------------------------------------------- grants / refunds / corrections

export type AppendResult = { kind: 'applied'; entry: RapidoLedgerEntry; balanceCents: number | null } | { kind: 'duplicate' };

/** Credits value from a source (Stripe event, allowance grant, referral, promo). Idempotent per sourceId. */
export async function grant(
  deps: RapidoLedgerDeps,
  input: {
    userId: string;
    sourceId: string;
    kind: 'grant' | 'purchase';
    bucket: RapidoValueBucket;
    amountCents: number;
    reason: string;
    actor?: string;
  },
): Promise<AppendResult> {
  const amount = toCents(input.amountCents);
  if (amount <= 0) throw new RapidoLedgerError('INVALID_INPUT', 'grant amount must be positive');
  const entry = buildEntry(deps, {
    slot: input.kind,
    userId: input.userId,
    operationId: requireText(input.sourceId, 'sourceId'),
    kind: input.kind,
    bucket: input.bucket,
    deltaCents: amount,
    amountCents: amount,
    reason: requireText(input.reason, 'reason'),
    actor: input.actor ?? RAPIDO_LEDGER_SYSTEM_ACTOR,
  });
  if ((await deps.store.appendEntry(entry)) === 'duplicate') return { kind: 'duplicate' };
  return { kind: 'applied', entry, balanceCents: await creditAfterJournal(deps, entry, amount) };
}

/** Returns (part of) a settled spend to the user. Never exceeds what is still refundable. */
export async function refund(
  deps: RapidoLedgerDeps,
  input: {
    userId: string;
    operationId: string;
    refundId: string;
    amountCents: number;
    reason: string;
    actor: string;
  },
): Promise<AppendResult | { kind: 'not_refundable'; refundableCents: number }> {
  const entries = (await deps.store.listEntries(input.userId)).filter((e) => e.operationId === input.operationId);
  const settled = entries.find((e) => e.kind === 'settle');
  const alreadyRefunded = entries.filter((e) => e.kind === 'refund').reduce((sum, e) => sum + e.amountCents, 0);
  const refundableCents = settled ? Math.max(0, settled.amountCents - alreadyRefunded) : 0;
  const amount = toCents(input.amountCents);
  if (amount <= 0 || amount > refundableCents) return { kind: 'not_refundable', refundableCents };

  const entry = buildEntry(deps, {
    slot: `refund:${requireText(input.refundId, 'refundId')}`,
    userId: input.userId,
    operationId: input.operationId,
    kind: 'refund',
    deltaCents: amount,
    amountCents: amount,
    reason: requireText(input.reason, 'reason'),
    actor: requireText(input.actor, 'actor'),
  });
  if ((await deps.store.appendEntry(entry)) === 'duplicate') return { kind: 'duplicate' };
  return { kind: 'applied', entry, balanceCents: await creditAfterJournal(deps, entry, amount) };
}

/** Expires value from one bucket (e.g. unused monthly allowance). Capped at the bucket's balance. */
export async function expire(
  deps: RapidoLedgerDeps,
  input: {
    userId: string;
    expiryId: string;
    bucket: RapidoValueBucket;
    amountCents: number;
    reason: string;
  },
): Promise<AppendResult | { kind: 'nothing_to_expire' } | { kind: 'insufficient' }> {
  const projection = projectBalance(await deps.store.listEntries(input.userId));
  const amount = Math.min(toCents(input.amountCents), Math.max(0, projection.buckets[input.bucket]));
  if (amount <= 0) return { kind: 'nothing_to_expire' };
  return applyDebitEntry(deps, {
    slot: 'expiry',
    userId: input.userId,
    operationId: requireText(input.expiryId, 'expiryId'),
    kind: 'expiry',
    bucket: input.bucket,
    deltaCents: -amount,
    amountCents: amount,
    reason: requireText(input.reason, 'reason'),
    actor: RAPIDO_LEDGER_SYSTEM_ACTOR,
  });
}

/** Manual balance adjustment. Requires an actor, a reason and a separate approver. */
export async function correct(
  deps: RapidoLedgerDeps,
  input: {
    userId: string;
    correctionId: string;
    bucket: RapidoValueBucket;
    deltaCents: number;
    reason: string;
    actor: string;
    approvedBy: string;
  },
): Promise<AppendResult | { kind: 'insufficient' }> {
  const delta = Number.isFinite(input.deltaCents) ? Math.round(input.deltaCents) : 0;
  if (delta === 0) throw new RapidoLedgerError('INVALID_INPUT', 'correction delta must be non-zero');
  const actor = requireText(input.actor, 'actor');
  const approvedBy = requireText(input.approvedBy, 'approvedBy');
  const fields = {
    slot: 'correction',
    userId: input.userId,
    operationId: requireText(input.correctionId, 'correctionId'),
    kind: 'correction' as const,
    bucket: input.bucket,
    deltaCents: delta,
    amountCents: Math.abs(delta),
    reason: requireText(input.reason, 'reason'),
    actor,
    approvedBy,
  };
  if (delta < 0) return applyDebitEntry(deps, fields);
  const entry = buildEntry(deps, fields);
  if ((await deps.store.appendEntry(entry)) === 'duplicate') return { kind: 'duplicate' };
  return { kind: 'applied', entry, balanceCents: await creditAfterJournal(deps, entry, delta) };
}

async function applyDebitEntry(
  deps: RapidoLedgerDeps,
  fields: Parameters<typeof buildEntry>[1],
): Promise<AppendResult | { kind: 'insufficient' }> {
  const entry = buildEntry(deps, fields);
  if (await deps.store.getEntry(entry.entryId)) return { kind: 'duplicate' };
  const debit = await deps.counter.debit(entry.amountCents);
  if (!debit.ok) return { kind: 'insufficient' };
  let appended: 'appended' | 'duplicate';
  try {
    appended = await deps.store.appendEntry(entry);
  } catch (error) {
    await deps.counter.credit(entry.amountCents);
    throw error;
  }
  if (appended === 'duplicate') {
    await deps.counter.credit(entry.amountCents);
    return { kind: 'duplicate' };
  }
  return { kind: 'applied', entry, balanceCents: debit.balanceCents };
}

// ----------------------------------------------------------------------------- projection

export type RapidoLedgerAnomalyCode =
  | 'DUPLICATE_RESERVE'
  | 'DUPLICATE_CLOSE'
  | 'CLOSE_WITHOUT_RESERVE'
  | 'REFUND_WITHOUT_SETTLE'
  | 'REFUND_EXCEEDS_SPEND'
  | 'DELTA_MISMATCH'
  | 'MISSING_BUCKET'
  | 'UNATTRIBUTED_SPEND';

export type RapidoLedgerAnomaly = {
  code: RapidoLedgerAnomalyCode;
  entryId: string;
  operationId: string;
  cents?: number;
};

type BucketMap = Record<RapidoValueBucket, number>;

export type RapidoProjection = {
  /** Sum of all entry deltas: what the legacy counter must equal. */
  availableCents: number;
  reservedCents: number;
  spentCents: number;
  buckets: BucketMap;
  spentByBucket: BucketMap;
  /** Spend no journaled credit explains (e.g. a grant that was never journaled). */
  unattributedCents: number;
  openReservations: string[];
  anomalies: RapidoLedgerAnomaly[];
};

function emptyBuckets(): BucketMap {
  return { allowance: 0, promotional: 0, earned: 0, legacy: 0, purchased: 0 };
}

function sortForReplay(entries: RapidoLedgerEntry[]): RapidoLedgerEntry[] {
  return [...entries].sort((a, b) => {
    const byTime = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
    if (byTime !== 0 && Number.isFinite(byTime)) return byTime;
    const byKind = KIND_REPLAY_ORDER[a.kind] - KIND_REPLAY_ORDER[b.kind];
    return byKind !== 0 ? byKind : a.entryId.localeCompare(b.entryId);
  });
}

function expectedDelta(entry: RapidoLedgerEntry, reservedCents: number): number | null {
  switch (entry.kind) {
    case 'opening':
    case 'grant':
    case 'purchase':
    case 'refund':
      return entry.amountCents;
    case 'reserve':
    case 'expiry':
      return -entry.amountCents;
    case 'void':
      return reservedCents;
    case 'settle':
      return reservedCents - entry.amountCents;
    case 'correction':
      return null;
    default: {
      const _exhaustive: never = entry.kind;
      throw new Error(`Unknown ledger entry kind: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Pure, deterministic replay of a user's journal. Spends draw buckets in RAPIDO_VALUE_BUCKETS order
 * (allowance first, purchased last); releases and refunds return value to the buckets it came from.
 */
export function projectBalance(entries: RapidoLedgerEntry[]): RapidoProjection {
  const buckets = emptyBuckets();
  const spentByBucket = emptyBuckets();
  const anomalies: RapidoLedgerAnomaly[] = [];
  const reservations = new Map<string, { amount: number; alloc: BucketMap; closed: boolean }>();
  const settledAlloc = new Map<string, BucketMap>();
  let availableCents = 0;
  let unattributedCents = 0;
  let spentCents = 0;

  const take = (amount: number): BucketMap => {
    const alloc = emptyBuckets();
    let remaining = amount;
    for (const bucket of RAPIDO_VALUE_BUCKETS) {
      const used = Math.min(remaining, Math.max(0, buckets[bucket]));
      buckets[bucket] -= used;
      alloc[bucket] += used;
      remaining -= used;
    }
    if (remaining > 0) unattributedCents += remaining;
    return alloc;
  };
  // Returns value from an allocation, purchased first, so refunds/releases restore paid value first.
  const giveBack = (alloc: BucketMap, amount: number): BucketMap => {
    const returned = emptyBuckets();
    let remaining = amount;
    for (const bucket of [...RAPIDO_VALUE_BUCKETS].reverse()) {
      const back = Math.min(remaining, alloc[bucket]);
      alloc[bucket] -= back;
      buckets[bucket] += back;
      returned[bucket] += back;
      remaining -= back;
    }
    if (remaining > 0) {
      // Value that was never attributed comes back as unattributed debt repayment first.
      const repaid = Math.min(remaining, unattributedCents);
      unattributedCents -= repaid;
      buckets.legacy += remaining - repaid;
    }
    return returned;
  };

  for (const entry of sortForReplay(entries)) {
    const reservation = reservations.get(entry.operationId);
    const expected = expectedDelta(entry, reservation?.amount ?? 0);
    if (expected !== null && expected !== entry.deltaCents) {
      anomalies.push({ code: 'DELTA_MISMATCH', entryId: entry.entryId, operationId: entry.operationId, cents: entry.deltaCents - expected });
    }
    availableCents += entry.deltaCents;

    switch (entry.kind) {
      case 'opening':
      case 'grant':
      case 'purchase': {
        const bucket = entry.bucket ?? 'legacy';
        if (!entry.bucket) anomalies.push({ code: 'MISSING_BUCKET', entryId: entry.entryId, operationId: entry.operationId });
        buckets[bucket] += entry.amountCents;
        break;
      }
      case 'correction': {
        const bucket = entry.bucket ?? 'legacy';
        if (!entry.bucket) anomalies.push({ code: 'MISSING_BUCKET', entryId: entry.entryId, operationId: entry.operationId });
        if (entry.deltaCents >= 0) {
          buckets[bucket] += entry.deltaCents;
        } else {
          const used = Math.min(-entry.deltaCents, Math.max(0, buckets[bucket]));
          buckets[bucket] -= used;
          if (-entry.deltaCents > used) take(-entry.deltaCents - used);
        }
        break;
      }
      case 'expiry': {
        const bucket = entry.bucket ?? 'legacy';
        const used = Math.min(entry.amountCents, Math.max(0, buckets[bucket]));
        buckets[bucket] -= used;
        if (entry.amountCents > used) take(entry.amountCents - used);
        break;
      }
      case 'reserve': {
        if (reservation) {
          anomalies.push({ code: 'DUPLICATE_RESERVE', entryId: entry.entryId, operationId: entry.operationId });
          break;
        }
        reservations.set(entry.operationId, { amount: entry.amountCents, alloc: take(entry.amountCents), closed: false });
        break;
      }
      case 'settle':
      case 'void': {
        if (!reservation) {
          anomalies.push({ code: 'CLOSE_WITHOUT_RESERVE', entryId: entry.entryId, operationId: entry.operationId });
          break;
        }
        if (reservation.closed) {
          anomalies.push({ code: 'DUPLICATE_CLOSE', entryId: entry.entryId, operationId: entry.operationId });
          break;
        }
        reservation.closed = true;
        if (entry.kind === 'void') {
          giveBack(reservation.alloc, reservation.amount);
          break;
        }
        const charged = entry.amountCents;
        const fromReserve = Math.min(charged, reservation.amount);
        giveBack(reservation.alloc, reservation.amount - fromReserve);
        const spent = { ...reservation.alloc };
        if (charged > reservation.amount) {
          const extra = take(charged - reservation.amount);
          for (const bucket of RAPIDO_VALUE_BUCKETS) spent[bucket] += extra[bucket];
        }
        for (const bucket of RAPIDO_VALUE_BUCKETS) spentByBucket[bucket] += spent[bucket];
        spentCents += charged;
        settledAlloc.set(entry.operationId, spent);
        break;
      }
      case 'refund': {
        const alloc = settledAlloc.get(entry.operationId);
        if (!alloc) {
          anomalies.push({ code: 'REFUND_WITHOUT_SETTLE', entryId: entry.entryId, operationId: entry.operationId });
          buckets.legacy += entry.amountCents;
          break;
        }
        const refundable = RAPIDO_VALUE_BUCKETS.reduce((sum, bucket) => sum + alloc[bucket], 0);
        if (entry.amountCents > refundable) {
          anomalies.push({
            code: 'REFUND_EXCEEDS_SPEND',
            entryId: entry.entryId,
            operationId: entry.operationId,
            cents: entry.amountCents - refundable,
          });
        }
        const returned = giveBack(alloc, entry.amountCents);
        for (const bucket of RAPIDO_VALUE_BUCKETS) spentByBucket[bucket] -= returned[bucket];
        spentCents -= entry.amountCents;
        break;
      }
      default: {
        const _exhaustive: never = entry.kind;
        throw new Error(`Unknown ledger entry kind: ${String(_exhaustive)}`);
      }
    }
  }

  const openReservations = [...reservations.entries()].filter(([, r]) => !r.closed).map(([id]) => id);
  const reservedCents = [...reservations.values()].filter((r) => !r.closed).reduce((sum, r) => sum + r.amount, 0);
  if (unattributedCents > 0) {
    anomalies.push({ code: 'UNATTRIBUTED_SPEND', entryId: '', operationId: '', cents: unattributedCents });
  }

  return {
    availableCents,
    reservedCents,
    spentCents,
    buckets,
    spentByBucket,
    unattributedCents,
    openReservations,
    anomalies,
  };
}

// ----------------------------------------------------------------------------- backfill & shadow reconciliation

/** The single auditable opening entry for a user. Never fabricates purchase/grant history. */
export function buildOpeningEntry(input: {
  userId: string;
  legacyCounterCents: number;
  actor: string;
  occurredAt: string;
}): RapidoLedgerEntry {
  const amount = toCents(input.legacyCounterCents);
  return {
    entryId: ledgerEntryId(input.userId, 'opening', 'opening'),
    userId: input.userId,
    operationId: 'opening',
    kind: 'opening',
    deltaCents: amount,
    amountCents: amount,
    bucket: 'legacy',
    reason: 'legacy_counter_backfill',
    actor: requireText(input.actor, 'actor'),
    approvedBy: null,
    operation: null,
    leaseExpiresAt: null,
    occurredAt: input.occurredAt,
  };
}

export type OpeningPlan =
  | { kind: 'create'; entry: RapidoLedgerEntry }
  | { kind: 'skip'; reason: 'already_opened' | 'negative_opening'; openingCents: number };

/**
 * Plans the opening entry when the ledger may already hold entries written before the backfill ran
 * (the runtime journals as soon as the table exists). The opening is the part of the legacy counter
 * the existing entries do not explain, dated before them so replay attributes it first.
 * Mirrored in scripts/rapido-ledger-backfill.mjs.
 */
export function planOpeningEntry(input: {
  userId: string;
  legacyCounterCents: number;
  existingEntries: RapidoLedgerEntry[];
  actor: string;
  now: Date;
}): OpeningPlan {
  const entries = input.existingEntries.filter((entry) => entry.userId === input.userId);
  const journaledCents = entries.reduce((sum, entry) => sum + entry.deltaCents, 0);
  const openingCents = toCents(input.legacyCounterCents) - journaledCents;
  if (entries.some((entry) => entry.kind === 'opening')) {
    return { kind: 'skip', reason: 'already_opened', openingCents };
  }
  if (openingCents < 0) return { kind: 'skip', reason: 'negative_opening', openingCents };
  const earliest = entries.reduce(
    (min, entry) => Math.min(min, Date.parse(entry.occurredAt) || min),
    input.now.getTime(),
  );
  const occurredAt = new Date(Math.min(input.now.getTime(), earliest - 1)).toISOString();
  return {
    kind: 'create',
    entry: buildOpeningEntry({ userId: input.userId, legacyCounterCents: openingCents, actor: input.actor, occurredAt }),
  };
}

export type RapidoReconciliation = {
  userId: string;
  legacyCounterCents: number;
  projectedAvailableCents: number;
  /** legacy counter minus journal projection; must be 0. */
  differenceCents: number;
  hasOpeningEntry: boolean;
  isReconciled: boolean;
  anomalies: RapidoLedgerAnomaly[];
  projection: RapidoProjection;
};

/** Shadow-read comparison. Reports drift only; never repairs balances or rewrites entries. */
export function reconcileShadowProjection(input: {
  userId: string;
  legacyCounterCents: number;
  entries: RapidoLedgerEntry[];
}): RapidoReconciliation {
  const entries = input.entries.filter((entry) => entry.userId === input.userId);
  const projection = projectBalance(entries);
  const legacyCounterCents = toCents(input.legacyCounterCents);
  const differenceCents = legacyCounterCents - projection.availableCents;
  const hasOpeningEntry = entries.some((entry) => entry.kind === 'opening');
  const blockingAnomalies = projection.anomalies.filter((anomaly) => anomaly.code !== 'UNATTRIBUTED_SPEND');
  return {
    userId: input.userId,
    legacyCounterCents,
    projectedAvailableCents: projection.availableCents,
    differenceCents,
    hasOpeningEntry,
    isReconciled: hasOpeningEntry && differenceCents === 0 && blockingAnomalies.length === 0,
    anomalies: projection.anomalies,
    projection,
  };
}

// ----------------------------------------------------------------------------- Appwrite store

function rowToEntry(row: RapidoLedgerEntryRow): RapidoLedgerEntry | null {
  if (!(RAPIDO_LEDGER_ENTRY_KINDS as readonly string[]).includes(row.kind)) return null;
  const bucket = typeof row.bucket === 'string' && (RAPIDO_VALUE_BUCKETS as readonly string[]).includes(row.bucket)
    ? (row.bucket as RapidoValueBucket)
    : null;
  return {
    entryId: row.$id,
    userId: row.user_id,
    operationId: row.operation_id,
    kind: row.kind as RapidoLedgerEntryKind,
    deltaCents: Number(row.delta_cents) || 0,
    amountCents: Number(row.amount_cents) || 0,
    bucket,
    reason: row.reason,
    actor: row.actor,
    approvedBy: row.approved_by ?? null,
    operation: row.operation ?? null,
    leaseExpiresAt: row.lease_expires_at ?? null,
    occurredAt: row.occurred_at,
  };
}

export function createAppwriteLedgerStore(): RapidoLedgerStore {
  const tables = getAdminTables();
  return {
    async appendEntry(entry) {
      try {
        await tables.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_RAPIDO_LEDGER_ID,
          rowId: entry.entryId,
          data: {
            user_id: entry.userId,
            operation_id: entry.operationId,
            kind: entry.kind,
            bucket: entry.bucket,
            delta_cents: entry.deltaCents,
            amount_cents: entry.amountCents,
            reason: entry.reason,
            actor: entry.actor,
            approved_by: entry.approvedBy,
            operation: entry.operation,
            lease_expires_at: entry.leaseExpiresAt,
            occurred_at: entry.occurredAt,
          },
        });
        return 'appended';
      } catch (error) {
        if (isAppwriteConflict(error)) return 'duplicate';
        throw error;
      }
    },
    async getEntry(entryId) {
      try {
        const row = await tables.getRow<RapidoLedgerEntryRow>({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_RAPIDO_LEDGER_ID,
          rowId: entryId,
        });
        return rowToEntry(row);
      } catch (error) {
        // A missing ROW is "no entry"; a missing TABLE must surface so callers fall back to legacy.
        if (isAppwriteNotFound(error) && !isLedgerTableMissing(error)) return null;
        throw error;
      }
    },
    async listEntries(userId) {
      const entries: RapidoLedgerEntry[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
        const result: { rows: RapidoLedgerEntryRow[] } = await tables.listRows<RapidoLedgerEntryRow>({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_RAPIDO_LEDGER_ID,
          queries: [
            Query.equal('user_id', userId),
            Query.limit(LIST_PAGE_SIZE),
            ...(cursor ? [Query.cursorAfter(cursor)] : []),
          ],
        });
        for (const row of result.rows) {
          const entry = rowToEntry(row);
          if (entry) entries.push(entry);
        }
        if (result.rows.length < LIST_PAGE_SIZE) return entries;
        cursor = result.rows[result.rows.length - 1].$id;
      }
      throw new RapidoLedgerError('LIST_TOO_LARGE', `Ledger for ${userId} exceeds the list limit`);
    },
  };
}

/** True when the error says the journal table/database itself is missing (not yet provisioned). */
export function isLedgerTableMissing(error: unknown): boolean {
  const typed = error as { type?: unknown; response?: { type?: unknown } } | null;
  const type = String(typed?.type ?? typed?.response?.type ?? '').toLowerCase();
  return type.includes('table_not_found') || type.includes('collection_not_found') || type.includes('database_not_found');
}
