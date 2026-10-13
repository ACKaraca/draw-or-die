import { Query, Users } from 'node-appwrite';

import {
  APPWRITE_BUCKET_GALLERY_ID,
  APPWRITE_DATABASE_ID,
  createAdminClient,
  getAdminStorage,
  getAdminTables,
} from '@/lib/appwrite/server';
import { isAppwriteNotFound } from '@/lib/appwrite/error-utils';

export type PrivacyRow = { $id: string; $createdAt?: string; $updatedAt?: string } & Record<string, unknown>;

export type RowFilter = { column: string; value: string };

export type DeleteOutcome = 'deleted' | 'missing';

/**
 * Narrow persistence surface used by export and deletion. Keeping it this small lets the
 * orchestration logic run against an in-memory fake in tests, so nothing destructive is
 * ever exercised against live data.
 */
export type PrivacyDataPort = {
  /** Returns at most `limit` rows matching `filter`, after `afterId` when paging. A missing table yields []. */
  listRows(tableId: string, filter: RowFilter, options: { limit: number; afterId?: string }): Promise<PrivacyRow[]>;
  deleteRow(tableId: string, rowId: string): Promise<DeleteOutcome>;
  deleteFile(fileId: string): Promise<DeleteOutcome>;
  deleteAuthUser(userId: string): Promise<DeleteOutcome>;
};

export const PRIVACY_PAGE_SIZE = 100;

const FILE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

export class PrivacyLimitExceededError extends Error {
  constructor(tableId: string) {
    super(`Privacy operation exceeded its row budget for table ${tableId}`);
    this.name = 'PrivacyLimitExceededError';
  }
}

export function createAppwritePrivacyPort(): PrivacyDataPort {
  return {
    async listRows(tableId, filter, options) {
      const queries = [
        Query.equal(filter.column, filter.value),
        Query.orderAsc('$id'),
        Query.limit(options.limit),
      ];
      if (options.afterId) queries.push(Query.cursorAfter(options.afterId));
      try {
        const result = await getAdminTables().listRows({ databaseId: APPWRITE_DATABASE_ID, tableId, queries });
        return result.rows as unknown as PrivacyRow[];
      } catch (error) {
        if (isAppwriteNotFound(error)) return [];
        throw error;
      }
    },
    async deleteRow(tableId, rowId) {
      try {
        await getAdminTables().deleteRow({ databaseId: APPWRITE_DATABASE_ID, tableId, rowId });
        return 'deleted';
      } catch (error) {
        if (isAppwriteNotFound(error)) return 'missing';
        throw error;
      }
    },
    async deleteFile(fileId) {
      try {
        await getAdminStorage().deleteFile({ bucketId: APPWRITE_BUCKET_GALLERY_ID, fileId });
        return 'deleted';
      } catch (error) {
        if (isAppwriteNotFound(error)) return 'missing';
        throw error;
      }
    },
    async deleteAuthUser(userId) {
      try {
        await new Users(createAdminClient()).delete({ userId });
        return 'deleted';
      } catch (error) {
        if (isAppwriteNotFound(error)) return 'missing';
        throw error;
      }
    },
  };
}

/** Pages through every row matching `filter`; throws once `maxRows` is exceeded instead of truncating silently. */
export async function collectAllRows(
  port: PrivacyDataPort,
  tableId: string,
  filter: RowFilter,
  maxRows: number,
): Promise<PrivacyRow[]> {
  const rows: PrivacyRow[] = [];
  let afterId: string | undefined;
  for (;;) {
    const page = await port.listRows(tableId, filter, { limit: PRIVACY_PAGE_SIZE, afterId });
    rows.push(...page);
    if (rows.length > maxRows) throw new PrivacyLimitExceededError(tableId);
    if (page.length < PRIVACY_PAGE_SIZE) return rows;
    afterId = page[page.length - 1]?.$id;
    if (!afterId) return rows;
  }
}

/** Deletes every row matching `filter`. Safe to re-run: already-missing rows count as done. */
export async function deleteAllRows(
  port: PrivacyDataPort,
  tableId: string,
  filter: RowFilter,
  maxRows = 20_000,
): Promise<number> {
  const rows = await collectAllRows(port, tableId, filter, maxRows);
  let deleted = 0;
  for (const row of rows) {
    if ((await port.deleteRow(tableId, row.$id)) === 'deleted') deleted += 1;
  }
  return deleted;
}

/** Extracts an Appwrite file id from a stored bucket URL (`/storage/buckets/<bucket>/files/<id>/...`) or a bare id. */
export function extractStorageFileId(value: unknown, bucketId: string = APPWRITE_BUCKET_GALLERY_ID): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!trimmed.includes('/')) return FILE_ID_PATTERN.test(trimmed) ? trimmed : null;

  const marker = `/storage/buckets/${bucketId}/files/`;
  const start = trimmed.indexOf(marker);
  if (start < 0) return null;
  const rest = trimmed.slice(start + marker.length);
  const rawId = rest.split(/[/?#]/)[0] ?? '';
  let fileId = rawId;
  try {
    fileId = decodeURIComponent(rawId);
  } catch {
    // Keep the raw id; the pattern check below still applies.
  }
  return FILE_ID_PATTERN.test(fileId) ? fileId : null;
}
