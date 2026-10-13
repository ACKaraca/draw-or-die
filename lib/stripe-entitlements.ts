import { createHash } from 'node:crypto';

import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_BILLING_EVENTS_ID,
  APPWRITE_TABLE_PROFILES_ID,
  getAdminTables,
  updateProfileById,
  type BillingEventRow,
  type UserProfileRow,
} from '@/lib/appwrite/server';
import { isAppwriteConflict, isAppwriteNotFound } from '@/lib/appwrite/error-utils';
import { logServerError } from '@/lib/logger';

/**
 * The single seam through which the Stripe webhook changes a user's value or access.
 *
 * - `ledger` effects (Rapido credit/revocation or a zero-value audit entry) are applied at
 *   most once per `sourceKey`: the billing_events row id is derived from the key, and the
 *   row is written in the same Appwrite transaction as the balance change. A retry after
 *   any partial failure either finds the row (already applied) or re-runs the whole effect.
 * - `subscription_state` effects are idempotent "set to Stripe's current truth" writes.
 *
 * When the append-only Rapido ledger lands, only this module needs to switch over.
 */

export type LedgerEntry = {
  eventType: string;
  amountCents: number;
  currency: string;
  stripeSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  metadata?: Record<string, unknown>;
};

export type EntitlementEffect =
  | {
      kind: 'ledger';
      /** Stable source identifier, e.g. `checkout:cs_123:rapido_pack` or `refund:re_123`. */
      sourceKey: string;
      userId: string;
      profileRowId: string | null;
      /** Balance the delta was computed from; used to clamp revocations and for the audit row. */
      knownBalance: number;
      /** Signed whole Rapido. Negative values revoke, clamped so the balance never goes below zero. */
      rapidoDelta: number;
      entry: LedgerEntry;
    }
  | {
      kind: 'subscription_state';
      userId: string;
      patch: Record<string, unknown>;
    };

export type EntitlementEffectResult = {
  applied: boolean;
  rapidoDelta: number;
  balanceAfter: number | null;
};

const MAX_BALANCE_AFTER = 1_000_000;

/** Deterministic Appwrite row id (≤36 chars, `[A-Za-z0-9]` start) for a source key. */
export function ledgerRowIdForSource(sourceKey: string): string {
  return `be${createHash('sha256').update(sourceKey).digest('hex').substring(0, 34)}`;
}

function buildLedgerRow(
  effect: Extract<EntitlementEffect, { kind: 'ledger' }>,
  rapidoDelta: number,
  balanceAfter: number,
): Record<string, string | number> {
  return {
    user_id: effect.userId,
    event_type: effect.entry.eventType.substring(0, 64),
    amount_cents: Math.max(0, Math.floor(effect.entry.amountCents)),
    currency: (effect.entry.currency || 'try').toLowerCase().substring(0, 8),
    rapido_delta: Math.trunc(rapidoDelta),
    rapido_balance_after: Math.min(MAX_BALANCE_AFTER, Math.max(0, Math.trunc(balanceAfter))),
    stripe_session_id: effect.entry.stripeSessionId ?? '',
    stripe_customer_id: effect.entry.stripeCustomerId ?? '',
    stripe_subscription_id: effect.entry.stripeSubscriptionId ?? '',
    metadata_json: JSON.stringify({ ...(effect.entry.metadata ?? {}), sourceKey: effect.sourceKey }),
  };
}

async function findExistingLedgerRow(rowId: string): Promise<BillingEventRow | null> {
  try {
    return await getAdminTables().getRow<BillingEventRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_BILLING_EVENTS_ID,
      rowId,
    });
  } catch (error) {
    if (isAppwriteNotFound(error)) return null;
    throw error;
  }
}

async function changeBalance(rowId: string, delta: number, transactionId?: string): Promise<void> {
  const tables = getAdminTables();
  if (delta > 0) {
    await tables.incrementRowColumn<UserProfileRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROFILES_ID,
      rowId,
      column: 'rapido_pens',
      value: delta,
      transactionId,
    });
  } else {
    await tables.decrementRowColumn<UserProfileRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROFILES_ID,
      rowId,
      column: 'rapido_pens',
      value: -delta,
      min: 0,
      transactionId,
    });
  }
}

async function applyLedgerEffect(
  effect: Extract<EntitlementEffect, { kind: 'ledger' }>,
): Promise<EntitlementEffectResult> {
  const ledgerRowId = ledgerRowIdForSource(effect.sourceKey);
  const existing = await findExistingLedgerRow(ledgerRowId);
  if (existing) {
    return { applied: false, rapidoDelta: Number(existing.rapido_delta) || 0, balanceAfter: null };
  }

  const knownBalance = Math.max(0, Math.trunc(effect.knownBalance));
  const requested = Math.trunc(effect.rapidoDelta);
  const rapidoDelta = requested < 0 ? -Math.min(-requested, knownBalance) : requested;
  const balanceAfter = knownBalance + rapidoDelta;
  const data = buildLedgerRow(effect, rapidoDelta, balanceAfter);
  const tables = getAdminTables();

  if (rapidoDelta === 0) {
    try {
      await tables.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_BILLING_EVENTS_ID,
        rowId: ledgerRowId,
        data,
      });
      return { applied: true, rapidoDelta: 0, balanceAfter };
    } catch (error) {
      if (isAppwriteConflict(error)) return { applied: false, rapidoDelta: 0, balanceAfter: null };
      throw error;
    }
  }

  if (!effect.profileRowId) {
    throw new Error(`Profile row id missing for ledger effect ${effect.sourceKey}`);
  }

  let transactionId: string | null = null;
  try {
    const transaction = await tables.createTransaction({ ttl: 60 });
    transactionId = transaction.$id;
  } catch (error) {
    logServerError('stripe-entitlements.transaction-unavailable', error, { sourceKey: effect.sourceKey });
  }

  if (transactionId) {
    try {
      await tables.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_BILLING_EVENTS_ID,
        rowId: ledgerRowId,
        data,
        transactionId,
      });
      await changeBalance(effect.profileRowId, rapidoDelta, transactionId);
      await tables.updateTransaction({ transactionId, commit: true });
      return { applied: true, rapidoDelta, balanceAfter };
    } catch (error) {
      try {
        await tables.updateTransaction({ transactionId, rollback: true });
      } catch {
        // Already committed/failed transactions cannot be rolled back; nothing staged survives.
      }
      if (isAppwriteConflict(error)) return { applied: false, rapidoDelta: 0, balanceAfter: null };
      throw error;
    }
  }

  // Fallback without transactions: the ledger row is the claim, the balance change follows,
  // and a failed balance change removes the claim again so the retry re-applies the effect.
  try {
    await tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_BILLING_EVENTS_ID,
      rowId: ledgerRowId,
      data,
    });
  } catch (error) {
    if (isAppwriteConflict(error)) return { applied: false, rapidoDelta: 0, balanceAfter: null };
    throw error;
  }

  try {
    await changeBalance(effect.profileRowId, rapidoDelta);
  } catch (error) {
    try {
      await tables.deleteRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_BILLING_EVENTS_ID,
        rowId: ledgerRowId,
      });
    } catch (cleanupError) {
      logServerError('stripe-entitlements.compensate', cleanupError, { sourceKey: effect.sourceKey });
    }
    throw error;
  }

  return { applied: true, rapidoDelta, balanceAfter };
}

export async function applyEntitlementEffect(effect: EntitlementEffect): Promise<EntitlementEffectResult> {
  switch (effect.kind) {
    case 'ledger':
      return applyLedgerEffect(effect);
    case 'subscription_state':
      await updateProfileById(effect.userId, effect.patch);
      return { applied: true, rapidoDelta: 0, balanceAfter: null };
    default: {
      const _exhaustive: never = effect;
      throw new Error(`Unknown entitlement effect: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
