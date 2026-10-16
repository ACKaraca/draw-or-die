// Pure comparison functions for scripts/reconcile-billing.mjs (plain ESM so the script runs under
// node without a build step; unit-tested in lib/billing-reconciliation.test.ts). Never does I/O.

import { createHash } from 'node:crypto';

const RAPIDO_PRECISION_SCALE = 100;

/**
 * @typedef {{ $id?: string; user_id: string; operation_id: string; kind: string; delta_cents: number;
 *   amount_cents: number; operation?: string | null; lease_expires_at?: string | null; occurred_at: string }} LedgerRow
 * @typedef {{ user_id: string; rapido_pens: number; rapido_fraction_cents?: number | null }} ProfileRow
 */

/** Mirrors `ledgerRowIdForSource` in lib/stripe-entitlements.ts (billing_events row id per source key). */
export function billingEventRowId(sourceKey) {
  return `be${createHash('sha256').update(sourceKey).digest('hex').substring(0, 34)}`;
}

/** Mirrors `toRapidoCents` in lib/rapido-cents.ts. */
export function counterCents(profile) {
  const pens = Number(profile.rapido_pens);
  const whole = Number.isFinite(pens) ? Math.max(0, Math.floor(pens)) : 0;
  const fraction = Math.min(RAPIDO_PRECISION_SCALE - 1, Math.max(0, Math.floor(Number(profile.rapido_fraction_cents) || 0)));
  return whole * RAPIDO_PRECISION_SCALE + fraction;
}

function isClose(row) {
  return row.kind === 'settle' || row.kind === 'void';
}

/**
 * (a) Legacy counter vs journal: the counter must equal sum(delta_cents) for every user that has an
 * opening entry. Users without one are not backfilled yet and are only counted.
 * @param {ProfileRow[]} profiles
 * @param {LedgerRow[]} ledgerRows
 * @param {{ now: Date; thresholdCents?: number }} options
 */
export function compareCountersToJournal(profiles, ledgerRows, { now, thresholdCents = 0 }) {
  const byUser = new Map();
  for (const row of ledgerRows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const drift = [];
  let usersCompared = 0;
  let usersWithoutOpening = 0;
  let openExpiredReservations = 0;
  for (const profile of profiles) {
    const entries = byUser.get(profile.user_id) ?? [];
    if (!entries.some((entry) => entry.kind === 'opening')) {
      usersWithoutOpening += 1;
      continue;
    }
    usersCompared += 1;
    const closed = new Set(entries.filter(isClose).map((entry) => entry.operation_id));
    const openExpired = entries.filter((entry) => entry.kind === 'reserve'
      && !closed.has(entry.operation_id)
      && entry.lease_expires_at
      && Date.parse(entry.lease_expires_at) <= now.getTime()).length;
    openExpiredReservations += openExpired;
    const journaledCents = entries.reduce((sum, entry) => sum + (Number(entry.delta_cents) || 0), 0);
    const differenceCents = counterCents(profile) - journaledCents;
    if (Math.abs(differenceCents) > thresholdCents || openExpired > 0) {
      drift.push({ userId: profile.user_id, counterCents: counterCents(profile), journaledCents, differenceCents, openExpired });
    }
  }
  return { usersCompared, usersWithoutOpening, openExpiredReservations, drift };
}

/**
 * (b) AI billing lifecycle per operation for reservations opened in [from, to): every reserve must be
 * closed exactly once (settle | void); a close without its reserve is an anomaly.
 * @param {LedgerRow[]} ledgerRows
 * @param {{ from: Date; to: Date }} window
 */
export function summarizeAiOperations(ledgerRows, { from, to }) {
  const inWindow = (row) => {
    const at = Date.parse(row.occurred_at);
    return at >= from.getTime() && at < to.getTime();
  };
  const key = (row) => `${row.user_id}|${row.operation_id}`;
  const closesByKey = new Map();
  const reserveKeys = new Set();
  for (const row of ledgerRows) {
    if (isClose(row)) closesByKey.set(key(row), [...(closesByKey.get(key(row)) ?? []), row]);
    if (row.kind === 'reserve') reserveKeys.add(key(row));
  }

  /** @type {Record<string, { reserved: number; settled: number; voided: number; open: number; reservedCents: number; chargedCents: number; voidedCents: number }>} */
  const byOperation = {};
  const bucketFor = (name) => {
    byOperation[name] ??= { reserved: 0, settled: 0, voided: 0, open: 0, reservedCents: 0, chargedCents: 0, voidedCents: 0 };
    return byOperation[name];
  };
  const anomalies = [];
  for (const row of ledgerRows) {
    if (row.kind === 'reserve' && inWindow(row)) {
      const stats = bucketFor(row.operation || 'UNKNOWN');
      stats.reserved += 1;
      stats.reservedCents += Number(row.amount_cents) || 0;
      const closes = closesByKey.get(key(row)) ?? [];
      if (closes.length === 0) stats.open += 1;
      if (closes.length > 1) anomalies.push({ code: 'DUPLICATE_CLOSE', userId: row.user_id, operationId: row.operation_id });
      for (const close of closes) {
        if (close.kind === 'settle') {
          stats.settled += 1;
          stats.chargedCents += Number(close.amount_cents) || 0;
        } else {
          stats.voided += 1;
          stats.voidedCents += Number(close.amount_cents) || 0;
        }
      }
    }
    if (isClose(row) && inWindow(row) && !reserveKeys.has(key(row))) {
      anomalies.push({ code: 'CLOSE_WITHOUT_RESERVE', userId: row.user_id, operationId: row.operation_id });
    }
  }
  return { byOperation, anomalies };
}

/**
 * Source keys the webhook writes for a paid Stripe object (lib/stripe-webhook-processor.ts). Any one
 * of them in billing_events means the payment was processed (granted or rejected for audit).
 */
export function expectedSourceKeys(stripeObject) {
  if (stripeObject.object === 'invoice') return [`invoice:${stripeObject.id}:premium_allowance`];
  const id = stripeObject.id;
  const primary = stripeObject.mode === 'subscription' ? `checkout:${id}:premium_allowance` : `checkout:${id}:rapido_pack`;
  return [primary, `checkout:${id}:rejected`];
}

/** Only paid Stripe objects that the webhook grants value for. First invoices are covered by checkout. */
export function isReconcilableStripeObject(stripeObject) {
  if (stripeObject.object === 'invoice') {
    return stripeObject.status === 'paid' && stripeObject.billing_reason === 'subscription_cycle';
  }
  return stripeObject.payment_status === 'paid';
}

/**
 * (c) Paid Stripe objects vs billing_events rows and ledger grants with matching source keys.
 * @param {Array<{ id: string; object: string; mode?: string; status?: string; payment_status?: string; billing_reason?: string }>} stripeObjects
 * @param {Map<string, { rapido_delta: number }>} billingEventsByRowId billing_events rows by row id
 * @param {Set<string>} ledgerSourceKeys operation_id of grant/purchase/correction ledger entries
 */
export function compareStripeToRecords(stripeObjects, billingEventsByRowId, ledgerSourceKeys) {
  const missingBillingEvent = [];
  const missingLedgerEntry = [];
  let checked = 0;
  for (const stripeObject of stripeObjects.filter(isReconcilableStripeObject)) {
    checked += 1;
    const keys = expectedSourceKeys(stripeObject);
    const matchedKey = keys.find((sourceKey) => billingEventsByRowId.has(billingEventRowId(sourceKey)));
    if (!matchedKey) {
      missingBillingEvent.push({ stripeId: stripeObject.id, expectedSourceKeys: keys });
      continue;
    }
    const delta = Number(billingEventsByRowId.get(billingEventRowId(matchedKey))?.rapido_delta) || 0;
    if (delta !== 0 && !ledgerSourceKeys.has(matchedKey)) {
      missingLedgerEntry.push({ stripeId: stripeObject.id, sourceKey: matchedKey, rapidoDelta: delta });
    }
  }
  return { checked, missingBillingEvent, missingLedgerEntry };
}

/** True when the report must fail the run (non-zero exit). */
export function hasBlockingDrift(report) {
  return report.counters.drift.length > 0
    || report.aiOperations.anomalies.length > 0
    || (report.stripe?.missingBillingEvent.length ?? 0) > 0
    || (report.stripe?.missingLedgerEntry.length ?? 0) > 0;
}
