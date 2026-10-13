// Read-only billing reconciliation report (DOD-23 / DOD-27 / DOD-28). NEVER WRITES: it only lists
// and reads rows, and only calls Stripe list endpoints.
//
//   node scripts/reconcile-billing.mjs                                  # last 7 days
//   node scripts/reconcile-billing.mjs --from 2026-10-01T00:00:00Z --to 2026-10-08T00:00:00Z
//   node scripts/reconcile-billing.mjs --user <id> --threshold 0 --skip-stripe
//
// Sections:
//   counters      profiles.rapido_pens (+ fraction) vs sum(delta_cents) of the Rapido ledger per user
//   aiOperations  reserve / settle / void counts per AI operation for reservations opened in the window
//   stripe        paid checkout sessions + renewal invoices in the window vs billing_events rows and
//                 ledger grants with the same deterministic source key (needs STRIPE_SECRET_KEY)
//
// Exit codes: 0 = reconciled, 2 = drift above --threshold (cents) or a missing record, 1 = failure.
// Pick a --from after the ledger table was provisioned: earlier Stripe grants have no ledger entry.
//
// Required env: APPWRITE_API_KEY (+ optional APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_DATABASE_ID,
// APPWRITE_TABLE_PROFILES_ID, APPWRITE_TABLE_RAPIDO_LEDGER_ID, APPWRITE_TABLE_BILLING_EVENTS_ID).
// Optional: STRIPE_SECRET_KEY (a restricted read-only key is enough).

import { Client, Query, TablesDB } from 'node-appwrite';
import Stripe from 'stripe';

import {
  billingEventRowId,
  compareCountersToJournal,
  compareStripeToRecords,
  expectedSourceKeys,
  hasBlockingDrift,
  isReconcilableStripeObject,
  summarizeAiOperations,
} from '../lib/billing-reconciliation.mjs';

const args = process.argv.slice(2);
const PAGE_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

function readFlag(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    console.error(`${name} requires a value.`);
    process.exit(1);
  }
  return value;
}

function readDate(name, fallback) {
  const raw = readFlag(name);
  if (!raw) return fallback;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    console.error(`${name} must be an ISO date.`);
    process.exit(1);
  }
  return parsed;
}

const now = new Date();
const to = readDate('--to', now);
const from = readDate('--from', new Date(to.getTime() - 7 * DAY_MS));
const onlyUserId = readFlag('--user');
const thresholdCents = Number.parseInt(readFlag('--threshold') ?? '0', 10);
const shouldSkipStripe = args.includes('--skip-stripe');
if (!Number.isFinite(thresholdCents) || thresholdCents < 0) {
  console.error('--threshold must be a non-negative integer (cents).');
  process.exit(1);
}

function validateAppwriteEndpoint(raw) {
  if (!raw) return 'https://fra.cloud.appwrite.io/v1';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') throw new Error('not https');
    return parsed.href.replace(/\/$/, '');
  } catch {
    console.error('APPWRITE_ENDPOINT must be a valid https URL.');
    process.exit(1);
  }
}

const apiKey = (process.env.APPWRITE_API_KEY ?? '').trim();
if (!apiKey) {
  console.error('APPWRITE_API_KEY is required.');
  process.exit(1);
}

const IDS = {
  database: process.env.APPWRITE_DATABASE_ID ?? 'draw_or_die',
  profiles: process.env.APPWRITE_TABLE_PROFILES_ID ?? 'profiles',
  ledger: process.env.APPWRITE_TABLE_RAPIDO_LEDGER_ID ?? 'rapido_ledger_entries',
  billingEvents: process.env.APPWRITE_TABLE_BILLING_EVENTS_ID ?? 'billing_events',
};

const tables = new TablesDB(
  new Client()
    .setEndpoint(validateAppwriteEndpoint(process.env.APPWRITE_ENDPOINT))
    .setProject(process.env.APPWRITE_PROJECT_ID ?? 'draw-or-die')
    .setKey(apiKey),
);

function isNotFound(error) {
  return Boolean(error) && (error.code === 404 || String(error.type ?? '').includes('not_found'));
}

async function listAll(tableId, extraQueries = []) {
  const rows = [];
  let cursor = null;
  for (;;) {
    const page = await tables.listRows({
      databaseId: IDS.database,
      tableId,
      queries: [...extraQueries, Query.limit(PAGE_SIZE), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
    });
    rows.push(...page.rows);
    if (page.rows.length < PAGE_SIZE) return rows;
    cursor = page.rows[page.rows.length - 1].$id;
  }
}

async function listLedgerRows() {
  try {
    return await listAll(IDS.ledger, onlyUserId ? [Query.equal('user_id', onlyUserId)] : []);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function getBillingEvent(rowId) {
  try {
    return await tables.getRow({ databaseId: IDS.database, tableId: IDS.billingEvents, rowId });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function listPaidStripeObjects(stripe) {
  const created = { gte: Math.floor(from.getTime() / 1000), lt: Math.floor(to.getTime() / 1000) };
  const objects = [];
  for await (const session of stripe.checkout.sessions.list({ created, status: 'complete', limit: 100 })) {
    if (!onlyUserId || session.metadata?.user_id === onlyUserId) objects.push(session);
  }
  if (!onlyUserId) {
    for await (const invoice of stripe.invoices.list({ created, status: 'paid', limit: 100 })) objects.push(invoice);
  }
  return objects.filter(isReconcilableStripeObject);
}

async function reconcileStripe(ledgerRows) {
  const secretKey = (process.env.STRIPE_SECRET_KEY ?? '').trim();
  if (shouldSkipStripe || !secretKey) return null;
  const stripeObjects = await listPaidStripeObjects(new Stripe(secretKey));

  const billingEventsByRowId = new Map();
  for (const stripeObject of stripeObjects) {
    for (const sourceKey of expectedSourceKeys(stripeObject)) {
      const rowId = billingEventRowId(sourceKey);
      const row = await getBillingEvent(rowId);
      if (row) billingEventsByRowId.set(rowId, row);
    }
  }
  const ledgerSourceKeys = new Set(
    (ledgerRows ?? []).filter((row) => ['grant', 'purchase', 'correction'].includes(row.kind)).map((row) => row.operation_id),
  );
  return compareStripeToRecords(stripeObjects, billingEventsByRowId, ledgerSourceKeys);
}

async function main() {
  const profiles = await listAll(IDS.profiles, onlyUserId ? [Query.equal('user_id', onlyUserId)] : []);
  const ledgerRows = await listLedgerRows();
  const report = {
    mode: 'read-only',
    window: { from: from.toISOString(), to: to.toISOString() },
    thresholdCents,
    ledgerTablePresent: ledgerRows !== null,
    counters: compareCountersToJournal(profiles, ledgerRows ?? [], { now, thresholdCents }),
    aiOperations: summarizeAiOperations(ledgerRows ?? [], { from, to }),
    stripe: await reconcileStripe(ledgerRows),
  };
  const isDrifting = hasBlockingDrift(report);
  console.log(JSON.stringify({ ...report, counters: { ...report.counters, drift: report.counters.drift.slice(0, 100) }, isDrifting }, null, 2));
  if (isDrifting) {
    console.error('Drift is reported only. Investigate; never edit balances or entries to make it disappear.');
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error('reconcile-billing failed:', error?.message ?? error);
  process.exit(1);
});
