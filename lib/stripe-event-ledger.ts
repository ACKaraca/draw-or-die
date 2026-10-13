import { randomUUID } from 'node:crypto';

import { ID, Query } from 'node-appwrite';

import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_STRIPE_EVENTS_ID,
  getAdminTables,
  type StripeEventRow,
} from '@/lib/appwrite/server';
import { isAppwriteConflict } from '@/lib/appwrite/error-utils';
import { logServerError } from '@/lib/logger';

/**
 * Durable processing state for Stripe webhook events, stored on the `stripe_events` row
 * (unique `event_id`):
 *
 *   processing --(effects committed)--> succeeded | ignored | rejected
 *   processing --(handler threw)------> failed --(retry / replay)--> processing
 *
 * A worker owns an event only while it holds an unexpired lease. Taking over a failed or
 * stale event bumps `attempts` with an atomic increment bounded by the value the worker
 * read, so two workers can never both win the same takeover. Business effects are
 * separately idempotent (see `lib/stripe-entitlements.ts`), so a worker that loses its
 * lease mid-flight cannot double-apply anything either.
 *
 * Rows without `status` are legacy rows (or one-time claim keys from `lib/idempotency.ts`)
 * and are treated as already processed.
 */

export const STRIPE_EVENT_LEASE_MS = 5 * 60_000;
const MAX_ERROR_LENGTH = 1_000;
const MAX_OUTCOME_LENGTH = 255;

export type StripeEventStatus = 'processing' | 'succeeded' | 'failed' | 'ignored' | 'rejected';

/** Terminal states: the event will not be processed again without an explicit replay. */
export const TERMINAL_STRIPE_EVENT_STATUSES: readonly StripeEventStatus[] = ['succeeded', 'ignored', 'rejected'];

export type StripeEventClaim = {
  rowId: string;
  eventId: string;
  leaseOwner: string;
  attempt: number;
};

export type StripeEventClaimResult =
  | { kind: 'claimed'; claim: StripeEventClaim }
  | { kind: 'duplicate'; status: string }
  | { kind: 'busy'; leaseExpiresAt: string | null };

export type StripeEventDescriptor = {
  id: string;
  type: string;
  livemode: boolean;
  created: number;
};

type ClaimOptions = {
  /** Replays may re-run a terminal `rejected` event; `succeeded`/`ignored` are never re-run. */
  allowRejected?: boolean;
  now?: () => number;
};

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.substring(0, max) : value;
}

export function describeError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return truncate(message, MAX_ERROR_LENGTH);
}

export async function findStripeEventRow(eventId: string): Promise<StripeEventRow | null> {
  const result = await getAdminTables().listRows<StripeEventRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_STRIPE_EVENTS_ID,
    queries: [Query.equal('event_id', eventId), Query.limit(1)],
  });
  return result.rows[0] ?? null;
}

export async function listStripeEventsByStatus(status: StripeEventStatus, limit = 25): Promise<StripeEventRow[]> {
  const result = await getAdminTables().listRows<StripeEventRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_STRIPE_EVENTS_ID,
    queries: [
      Query.equal('status', status),
      Query.orderAsc('$createdAt'),
      Query.limit(Math.max(1, Math.min(100, Math.trunc(limit)))),
    ],
  });
  return result.rows;
}

function isLeaseActive(row: StripeEventRow, nowMs: number): boolean {
  if (!row.lease_expires_at) return false;
  const expires = Date.parse(row.lease_expires_at);
  return Number.isFinite(expires) && expires > nowMs;
}

/**
 * Claims an event for processing. Returns `duplicate` for events already in a terminal
 * state, `busy` when another worker holds a live lease, otherwise a claim with a fresh lease.
 * Storage errors propagate: the caller must fail closed (non-2xx) so Stripe retries.
 */
export async function claimStripeEvent(
  event: StripeEventDescriptor,
  options: ClaimOptions = {},
): Promise<StripeEventClaimResult> {
  const now = options.now ?? Date.now;
  const tables = getAdminTables();
  const leaseOwner = randomUUID();
  const startedAt = now();

  try {
    const row = await tables.createRow<StripeEventRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_STRIPE_EVENTS_ID,
      rowId: ID.unique(),
      data: {
        event_id: event.id,
        processed_at: toIso(startedAt),
        status: 'processing',
        event_type: truncate(event.type, 128),
        attempts: 1,
        lease_owner: leaseOwner,
        lease_expires_at: toIso(startedAt + STRIPE_EVENT_LEASE_MS),
        livemode: event.livemode,
        stripe_created_at: Number.isFinite(event.created) && event.created > 0 ? toIso(event.created * 1000) : null,
        updated_at: toIso(startedAt),
      },
    });
    return { kind: 'claimed', claim: { rowId: row.$id, eventId: event.id, leaseOwner, attempt: 1 } };
  } catch (error) {
    if (!isAppwriteConflict(error)) throw error;
  }

  const existing = await findStripeEventRow(event.id);
  if (!existing) {
    // Unique-index conflict but the row is not readable yet; let Stripe retry.
    return { kind: 'busy', leaseExpiresAt: null };
  }

  const status = existing.status ?? '';
  if (!status) return { kind: 'duplicate', status: 'legacy' };
  if (status === 'rejected' && options.allowRejected) {
    // fall through to takeover
  } else if ((TERMINAL_STRIPE_EVENT_STATUSES as readonly string[]).includes(status)) {
    return { kind: 'duplicate', status };
  }

  const nowMs = now();
  if (status === 'processing' && isLeaseActive(existing, nowMs)) {
    return { kind: 'busy', leaseExpiresAt: existing.lease_expires_at ?? null };
  }

  // Failed, rejected-on-replay, or a stale processing lease: take it over. The bounded
  // increment is a compare-and-set on `attempts`; a concurrent taker makes it throw.
  const observedAttempts = Number.isFinite(existing.attempts) ? Number(existing.attempts) : 0;
  const nextAttempt = observedAttempts + 1;
  try {
    await tables.incrementRowColumn<StripeEventRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_STRIPE_EVENTS_ID,
      rowId: existing.$id,
      column: 'attempts',
      value: 1,
      max: nextAttempt,
    });
  } catch {
    return { kind: 'busy', leaseExpiresAt: existing.lease_expires_at ?? null };
  }

  await tables.updateRow<StripeEventRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_STRIPE_EVENTS_ID,
    rowId: existing.$id,
    data: {
      status: 'processing',
      lease_owner: leaseOwner,
      lease_expires_at: toIso(nowMs + STRIPE_EVENT_LEASE_MS),
      updated_at: toIso(nowMs),
    },
  });

  return {
    kind: 'claimed',
    claim: { rowId: existing.$id, eventId: event.id, leaseOwner, attempt: nextAttempt },
  };
}

/**
 * Writes the final state only while this worker still owns the lease. Returns false when
 * another worker took the event over (its own result will be recorded instead).
 */
async function finalizeClaim(
  claim: StripeEventClaim,
  data: Partial<StripeEventRow>,
  now: () => number,
): Promise<boolean> {
  const tables = getAdminTables();
  const current = await tables.getRow<StripeEventRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_STRIPE_EVENTS_ID,
    rowId: claim.rowId,
  });
  if (current.lease_owner !== claim.leaseOwner) {
    logServerError('stripe-event-ledger.lease-lost', new Error('Lease taken over before finalize'), {
      eventId: claim.eventId,
      attempt: claim.attempt,
    });
    return false;
  }

  await tables.updateRow<StripeEventRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_STRIPE_EVENTS_ID,
    rowId: claim.rowId,
    data: {
      ...data,
      lease_owner: '',
      lease_expires_at: null,
      updated_at: toIso(now()),
    },
  });
  return true;
}

export async function completeStripeEvent(
  claim: StripeEventClaim,
  status: Extract<StripeEventStatus, 'succeeded' | 'ignored' | 'rejected'>,
  outcome: string,
  now: () => number = Date.now,
): Promise<boolean> {
  return finalizeClaim(claim, {
    status,
    outcome: truncate(outcome, MAX_OUTCOME_LENGTH),
    last_error: '',
    processed_at: toIso(now()),
  }, now);
}

/** Marks the event failed so Stripe's retry (or a replay) can take it over. Never throws. */
export async function failStripeEvent(
  claim: StripeEventClaim,
  error: unknown,
  now: () => number = Date.now,
): Promise<void> {
  try {
    await finalizeClaim(claim, { status: 'failed', last_error: describeError(error) }, now);
  } catch (finalizeError) {
    // The lease simply expires; the next delivery takes the event over as stale.
    logServerError('stripe-event-ledger.fail', finalizeError, { eventId: claim.eventId });
  }
}

/**
 * Removes a one-time claim row written by `markStripeEventProcessed` / `claimOnce` so the
 * guarded work can be retried. Stripe webhook events are never deleted; they move to
 * `failed` instead. Best-effort: errors are logged and reported via the return value.
 */
export async function releaseStripeEvent(eventId: string): Promise<boolean> {
  try {
    const tables = getAdminTables();
    const result = await tables.listRows<StripeEventRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_STRIPE_EVENTS_ID,
      queries: [
        Query.equal('event_id', eventId),
        Query.limit(5),
      ],
    });

    await Promise.all(
      result.rows
        .filter((row) => !row.status)
        .map((row) =>
          tables.deleteRow({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: APPWRITE_TABLE_STRIPE_EVENTS_ID,
            rowId: row.$id,
          }),
        ),
    );

    return true;
  } catch (error) {
    logServerError('stripe-event-ledger.release', error, { eventId });
    return false;
  }
}
