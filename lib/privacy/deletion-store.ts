import type { TablesDB } from 'node-appwrite';

import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_DELETION_REQUESTS_ID,
  getAdminTables,
} from '@/lib/appwrite/server';
import { isAppwriteConflict, isAppwriteNotFound } from '@/lib/appwrite/error-utils';
import type { DeletionRequestRecord, DeletionRequestStore } from '@/lib/privacy/deletion';

const RECORD_JSON_MAX = 30_000;
const ENSURE_TTL_MS = 6 * 60 * 60 * 1000;

let ensuredAt = 0;

/** Appwrite ids allow 36 chars; a hash prefix keeps the row id deterministic, so one request exists per subject. */
export function deletionRequestRowId(subjectHash: string): string {
  return `del${subjectHash.slice(0, 33)}`;
}

export function parseDeletionRecord(raw: unknown): DeletionRequestRecord | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<DeletionRequestRecord>;
    if (typeof candidate.subjectHash !== 'string' || !candidate.steps || !candidate.tombstone) return null;
    return candidate as DeletionRequestRecord;
  } catch {
    return null;
  }
}

async function ensureColumn(tables: TablesDB, key: string, size: number): Promise<void> {
  try {
    await tables.getColumn({ databaseId: APPWRITE_DATABASE_ID, tableId: APPWRITE_TABLE_DELETION_REQUESTS_ID, key });
  } catch (error) {
    if (!isAppwriteNotFound(error)) throw error;
    try {
      await tables.createStringColumn({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_DELETION_REQUESTS_ID,
        key,
        size,
        required: true,
      });
    } catch (createError) {
      if (!isAppwriteConflict(createError)) throw createError;
    }
  }
}

/** Server-only table (no row security, no client permissions); only the admin key can read or write it. */
export async function ensureDeletionRequestsTable(): Promise<void> {
  if (Date.now() - ensuredAt < ENSURE_TTL_MS) return;
  const tables = getAdminTables();
  try {
    await tables.getTable({ databaseId: APPWRITE_DATABASE_ID, tableId: APPWRITE_TABLE_DELETION_REQUESTS_ID });
  } catch (error) {
    if (!isAppwriteNotFound(error)) throw error;
    try {
      await tables.createTable({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_DELETION_REQUESTS_ID,
        name: 'Deletion Requests',
        rowSecurity: false,
        enabled: true,
      });
    } catch (createError) {
      if (!isAppwriteConflict(createError)) throw createError;
    }
  }
  await ensureColumn(tables, 'subject_hash', 64);
  await ensureColumn(tables, 'status', 32);
  await ensureColumn(tables, 'contract_version', 64);
  await ensureColumn(tables, 'record_json', RECORD_JSON_MAX);
  ensuredAt = Date.now();
}

export function createAppwriteDeletionStore(tables: TablesDB = getAdminTables()): DeletionRequestStore {
  return {
    async get(subjectHash) {
      try {
        const row = await tables.getRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_DELETION_REQUESTS_ID,
          rowId: deletionRequestRowId(subjectHash),
        });
        return parseDeletionRecord((row as unknown as Record<string, unknown>).record_json);
      } catch (error) {
        if (isAppwriteNotFound(error)) return null;
        throw error;
      }
    },
    async save(record) {
      const recordJson = JSON.stringify(record);
      if (recordJson.length > RECORD_JSON_MAX) throw new Error('Deletion record exceeds storage limit');
      await tables.upsertRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_DELETION_REQUESTS_ID,
        rowId: deletionRequestRowId(record.subjectHash),
        data: {
          subject_hash: record.subjectHash,
          status: record.status,
          contract_version: record.contractVersion,
          record_json: recordJson,
        },
      });
    },
  };
}
