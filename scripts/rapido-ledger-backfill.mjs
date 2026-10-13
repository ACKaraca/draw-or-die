// Rapido ledger (DOD-23) schema + opening-balance backfill + shadow reconciliation.
//
// DRY-RUN BY DEFAULT: without --apply this script only reads and prints a plan. It never changes a
// balance, and it never updates or deletes a ledger entry in any mode.
//
//   node scripts/rapido-ledger-backfill.mjs                 # dry run: schema check + opening plan + drift report
//   node scripts/rapido-ledger-backfill.mjs --apply         # create table/columns/indexes, then opening entries
//   node scripts/rapido-ledger-backfill.mjs --user <id>     # limit to one user (dry run or apply)
//   node scripts/rapido-ledger-backfill.mjs --actor <name>  # recorded on opening entries (default: backfill-script)
//
// Required env: APPWRITE_API_KEY (+ optional APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_DATABASE_ID,
// APPWRITE_TABLE_PROFILES_ID, APPWRITE_TABLE_RAPIDO_LEDGER_ID). Owner/finance approval is required before
// --apply (see docs/enterprise-audit/branches/15-fix-atomic-rapido-ledger/MIGRATION.md).
//
// The entry-id and opening formulas mirror lib/rapido-ledger.ts (ledgerEntryId, planOpeningEntry).
// Keep them in sync: the runtime and this script must derive the same row id for the same entry.

import { createHash } from 'node:crypto';

import { Client, OrderBy, Query, TablesDB, TablesDBIndexType } from 'node-appwrite';

const args = process.argv.slice(2);
const shouldApply = args.includes('--apply');
const onlyUserId = readFlag('--user');
const actor = readFlag('--actor') ?? 'backfill-script';
const PAGE_SIZE = 100;
const RAPIDO_PRECISION_SCALE = 100;

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

function validateAppwriteEndpoint(raw) {
  const DEFAULT_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
  if (!raw) return DEFAULT_ENDPOINT;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') {
      console.error('APPWRITE_ENDPOINT must use https protocol.');
      process.exit(1);
    }
    return parsed.href.replace(/\/$/, '');
  } catch {
    console.error('APPWRITE_ENDPOINT is not a valid URL.');
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
};

const client = new Client()
  .setEndpoint(validateAppwriteEndpoint(process.env.APPWRITE_ENDPOINT))
  .setProject(process.env.APPWRITE_PROJECT_ID ?? 'draw-or-die')
  .setKey(apiKey);
const tables = new TablesDB(client);

function isNotFound(error) {
  return Boolean(error) && (error.code === 404 || String(error.type ?? '').includes('not_found'));
}

function isConflict(error) {
  return Boolean(error) && (error.code === 409 || String(error.type ?? '').includes('already_exists'));
}

function ledgerEntryId(userId, operationId, slot) {
  return createHash('sha256').update(`${userId}|${operationId}|${slot}`).digest('hex').slice(0, 36);
}

function toCents(pens, fractionCents) {
  const whole = Number.isFinite(Number(pens)) ? Math.max(0, Math.floor(Number(pens))) : 0;
  const fraction = Math.min(RAPIDO_PRECISION_SCALE - 1, Math.max(0, Math.floor(Number(fractionCents) || 0)));
  return whole * RAPIDO_PRECISION_SCALE + fraction;
}

// --------------------------------------------------------------------------------------- schema

const LEDGER_COLUMNS = [
  { type: 'string', key: 'user_id', size: 64, required: true },
  { type: 'string', key: 'operation_id', size: 128, required: true },
  { type: 'string', key: 'kind', size: 16, required: true },
  { type: 'string', key: 'bucket', size: 16, required: false },
  { type: 'integer', key: 'delta_cents', required: true },
  { type: 'integer', key: 'amount_cents', required: true, min: 0 },
  { type: 'string', key: 'reason', size: 256, required: true },
  { type: 'string', key: 'actor', size: 128, required: true },
  { type: 'string', key: 'approved_by', size: 128, required: false },
  { type: 'string', key: 'operation', size: 64, required: false },
  { type: 'datetime', key: 'lease_expires_at', required: false },
  { type: 'datetime', key: 'occurred_at', required: true },
];

const LEDGER_INDEXES = [
  { key: 'rapido_ledger_user_idx', columns: ['user_id'] },
  { key: 'rapido_ledger_user_operation_idx', columns: ['user_id', 'operation_id'] },
  { key: 'rapido_ledger_kind_lease_idx', columns: ['kind', 'lease_expires_at'] },
];

async function isLedgerTablePresent() {
  try {
    await tables.getTable({ databaseId: IDS.database, tableId: IDS.ledger });
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

async function ensureLedgerSchema() {
  let createdSomething = false;
  if (!(await isLedgerTablePresent())) {
    // Server-only table: no client permissions, no row security.
    await tables.createTable({
      databaseId: IDS.database,
      tableId: IDS.ledger,
      name: 'Rapido Ledger Entries',
      permissions: [],
      rowSecurity: false,
      enabled: true,
    });
    console.log(`Table created: ${IDS.ledger}`);
    createdSomething = true;
  }

  for (const column of LEDGER_COLUMNS) {
    try {
      await tables.getColumn({ databaseId: IDS.database, tableId: IDS.ledger, key: column.key });
      continue;
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    const base = { databaseId: IDS.database, tableId: IDS.ledger, key: column.key, required: column.required };
    if (column.type === 'string') await tables.createStringColumn({ ...base, size: column.size });
    if (column.type === 'integer') await tables.createIntegerColumn({ ...base, min: column.min });
    if (column.type === 'datetime') await tables.createDatetimeColumn(base);
    console.log(`Column created: ${IDS.ledger}.${column.key}`);
    createdSomething = true;
  }

  for (const index of LEDGER_INDEXES) {
    try {
      await tables.getIndex({ databaseId: IDS.database, tableId: IDS.ledger, key: index.key });
      continue;
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    try {
      await tables.createIndex({
        databaseId: IDS.database,
        tableId: IDS.ledger,
        key: index.key,
        type: TablesDBIndexType.Key,
        columns: index.columns,
        orders: index.columns.map(() => OrderBy.Asc),
      });
      console.log(`Index created: ${IDS.ledger}.${index.key}`);
      createdSomething = true;
    } catch (error) {
      console.warn(`Index ${index.key} not created yet (columns may still be processing): ${error.message}`);
      createdSomething = true;
    }
  }
  return createdSomething;
}

// --------------------------------------------------------------------------------------- reads

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

function planOpening(userId, legacyCounterCents, entries, now) {
  const journaledCents = entries.reduce((sum, entry) => sum + Number(entry.delta_cents || 0), 0);
  const openingCents = legacyCounterCents - journaledCents;
  if (entries.some((entry) => entry.kind === 'opening')) return { kind: 'skip', reason: 'already_opened', openingCents };
  if (openingCents < 0) return { kind: 'skip', reason: 'negative_opening', openingCents };
  const earliest = entries.reduce((min, entry) => Math.min(min, Date.parse(entry.occurred_at) || min), now.getTime());
  return {
    kind: 'create',
    rowId: ledgerEntryId(userId, 'opening', 'opening'),
    data: {
      user_id: userId,
      operation_id: 'opening',
      kind: 'opening',
      bucket: 'legacy',
      delta_cents: openingCents,
      amount_cents: openingCents,
      reason: 'legacy_counter_backfill',
      actor,
      approved_by: null,
      operation: null,
      lease_expires_at: null,
      occurred_at: new Date(Math.min(now.getTime(), earliest - 1)).toISOString(),
    },
  };
}

// --------------------------------------------------------------------------------------- main

async function main() {
  console.log(`Mode: ${shouldApply ? 'APPLY' : 'DRY RUN (no writes)'}${onlyUserId ? `, user=${onlyUserId}` : ''}`);

  const hasLedgerTable = await isLedgerTablePresent();
  if (shouldApply) {
    const isSchemaChanged = await ensureLedgerSchema();
    if (isSchemaChanged) {
      console.log('Schema was created/extended. Wait until all columns are "available" in Appwrite, then re-run --apply.');
      return;
    }
  } else if (!hasLedgerTable) {
    console.log(`Ledger table "${IDS.ledger}" does not exist yet; --apply would create it with:`);
    console.log(JSON.stringify({ columns: LEDGER_COLUMNS, indexes: LEDGER_INDEXES }, null, 2));
  }

  const profileQueries = onlyUserId ? [Query.equal('user_id', onlyUserId)] : [];
  const profiles = await listAll(IDS.profiles, profileQueries);
  const ledgerRows = hasLedgerTable
    ? await listAll(IDS.ledger, onlyUserId ? [Query.equal('user_id', onlyUserId)] : [])
    : [];
  const entriesByUser = new Map();
  for (const row of ledgerRows) {
    const list = entriesByUser.get(row.user_id) ?? [];
    list.push(row);
    entriesByUser.set(row.user_id, list);
  }

  const now = new Date();
  const summary = { profiles: 0, toCreate: 0, toCreateCents: 0, alreadyOpened: 0, negative: 0, created: 0, drift: [] };

  for (const profile of profiles) {
    const userId = String(profile.user_id ?? '');
    if (!userId) continue;
    summary.profiles += 1;
    const counterCents = toCents(profile.rapido_pens, profile.rapido_fraction_cents);
    const entries = entriesByUser.get(userId) ?? [];
    const plan = planOpening(userId, counterCents, entries, now);

    if (plan.kind === 'skip') {
      if (plan.reason === 'already_opened') {
        summary.alreadyOpened += 1;
        const differenceCents = plan.openingCents;
        if (differenceCents !== 0) summary.drift.push({ userId, counterCents, differenceCents });
      } else {
        summary.negative += 1;
        summary.drift.push({ userId, counterCents, differenceCents: plan.openingCents, note: 'journal exceeds counter' });
      }
      continue;
    }

    summary.toCreate += 1;
    summary.toCreateCents += plan.data.amount_cents;
    if (!shouldApply) continue;
    try {
      await tables.createRow({ databaseId: IDS.database, tableId: IDS.ledger, rowId: plan.rowId, data: plan.data });
      summary.created += 1;
    } catch (error) {
      if (isConflict(error)) {
        summary.alreadyOpened += 1;
        continue;
      }
      throw error;
    }
  }

  console.log(JSON.stringify({
    profilesScanned: summary.profiles,
    openingEntriesPlanned: summary.toCreate,
    openingCentsPlanned: summary.toCreateCents,
    openingEntriesCreated: summary.created,
    alreadyOpened: summary.alreadyOpened,
    negativeOpenings: summary.negative,
    unexplainedDriftUsers: summary.drift.length,
    driftSample: summary.drift.slice(0, 20),
  }, null, 2));
  if (summary.drift.length > 0) {
    console.log('Drift is reported only. Investigate; never edit balances or entries to make it disappear.');
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error('rapido-ledger-backfill failed:', error?.message ?? error);
  process.exit(1);
});
