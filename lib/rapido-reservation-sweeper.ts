import { Query } from 'node-appwrite';

import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_RAPIDO_LEDGER_ID,
  getAdminTables,
  getProfileRowForUser,
  type RapidoLedgerEntryRow,
} from '@/lib/appwrite/server';
import { logServerError } from '@/lib/logger';
import { createProfileRapidoCounter } from '@/lib/rapido-balance';
import { createAppwriteLedgerStore, isLedgerTableMissing, voidExpiredReservations } from '@/lib/rapido-ledger';

// shortcut: only leases that expired within the lookback window are swept, so an outage longer than
// it leaves reservations open; scripts/reconcile-billing.mjs reports them. Widen it if that happens.
// Daily cron (Vercel Hobby allows only daily schedules); 48h lookback covers one missed run.
export const SWEEP_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const SWEEP_PAGE_SIZE = 500;
const SWEEP_MAX_PAGES = 4;

export type ReservationSweepResult =
  | { status: 'ok'; usersScanned: number; voided: number; failedUsers: number; missingProfiles: number }
  | { status: 'ledger_unavailable' };

async function listUsersWithExpiredLeases(now: Date): Promise<Set<string>> {
  const tables = getAdminTables();
  const userIds = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < SWEEP_MAX_PAGES; page += 1) {
    const result: { rows: RapidoLedgerEntryRow[] } = await tables.listRows<RapidoLedgerEntryRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_RAPIDO_LEDGER_ID,
      queries: [
        Query.equal('kind', 'reserve'),
        Query.lessThanEqual('lease_expires_at', now.toISOString()),
        Query.greaterThan('lease_expires_at', new Date(now.getTime() - SWEEP_LOOKBACK_MS).toISOString()),
        Query.limit(SWEEP_PAGE_SIZE),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });
    for (const row of result.rows) userIds.add(row.user_id);
    if (result.rows.length < SWEEP_PAGE_SIZE) break;
    cursor = result.rows[result.rows.length - 1].$id;
  }
  return userIds;
}

/** Voids every open reservation whose lease expired (e.g. the AI function was killed mid-request). */
export async function sweepExpiredRapidoReservations(now: Date = new Date()): Promise<ReservationSweepResult> {
  let userIds: Set<string>;
  try {
    userIds = await listUsersWithExpiredLeases(now);
  } catch (error) {
    if (isLedgerTableMissing(error)) return { status: 'ledger_unavailable' };
    throw error;
  }

  const store = createAppwriteLedgerStore();
  let voided = 0;
  let failedUsers = 0;
  let missingProfiles = 0;
  for (const userId of userIds) {
    try {
      const profileRow = await getProfileRowForUser(userId);
      if (!profileRow) {
        missingProfiles += 1;
        continue;
      }
      const counter = createProfileRapidoCounter({ userId, profileRowId: profileRow.$id });
      voided += (await voidExpiredReservations({ store, counter, now: () => now }, userId)).length;
    } catch (error) {
      failedUsers += 1;
      logServerError('rapido.sweep.user_failed', error, { userId });
    }
  }
  return { status: 'ok', usersScanned: userIds.size, voided, failedUsers, missingProfiles };
}
