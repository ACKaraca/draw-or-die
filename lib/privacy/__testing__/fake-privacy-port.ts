import type { DeleteOutcome, PrivacyDataPort, PrivacyRow } from '@/lib/privacy/data-port';
import type { DeletionRequestRecord, DeletionRequestStore } from '@/lib/privacy/deletion';

type FailureHooks = {
  deleteRow?: (tableId: string, rowId: string) => void;
  deleteFile?: (fileId: string) => void;
  deleteAuthUser?: (userId: string) => void;
  listRows?: (tableId: string) => void;
};

/** In-memory stand-in for Appwrite tables/storage/users, with per-call failure injection. */
export class FakePrivacyPort implements PrivacyDataPort {
  readonly tables = new Map<string, PrivacyRow[]>();
  readonly files = new Set<string>();
  readonly authUsers = new Set<string>();
  readonly failures: FailureHooks = {};

  seed(tableId: string, rows: PrivacyRow[]): void {
    this.tables.set(tableId, [...(this.tables.get(tableId) ?? []), ...rows]);
  }

  rowsOf(tableId: string): PrivacyRow[] {
    return this.tables.get(tableId) ?? [];
  }

  async listRows(
    tableId: string,
    filter: { column: string; value: string },
    options: { limit: number; afterId?: string },
  ): Promise<PrivacyRow[]> {
    this.failures.listRows?.(tableId);
    const matching = this.rowsOf(tableId)
      .filter((row) => row[filter.column] === filter.value)
      .sort((a, b) => a.$id.localeCompare(b.$id));
    const { afterId } = options;
    const start = afterId ? matching.findIndex((row) => row.$id > afterId) : 0;
    if (start < 0) return [];
    return matching.slice(start, start + options.limit);
  }

  async deleteRow(tableId: string, rowId: string): Promise<DeleteOutcome> {
    this.failures.deleteRow?.(tableId, rowId);
    const rows = this.rowsOf(tableId);
    const next = rows.filter((row) => row.$id !== rowId);
    this.tables.set(tableId, next);
    return next.length === rows.length ? 'missing' : 'deleted';
  }

  async deleteFile(fileId: string): Promise<DeleteOutcome> {
    this.failures.deleteFile?.(fileId);
    return this.files.delete(fileId) ? 'deleted' : 'missing';
  }

  async deleteAuthUser(userId: string): Promise<DeleteOutcome> {
    this.failures.deleteAuthUser?.(userId);
    return this.authUsers.delete(userId) ? 'deleted' : 'missing';
  }
}

export class InMemoryDeletionStore implements DeletionRequestStore {
  readonly records = new Map<string, string>();
  saveCount = 0;

  async get(subjectHash: string): Promise<DeletionRequestRecord | null> {
    const raw = this.records.get(subjectHash);
    return raw ? (JSON.parse(raw) as DeletionRequestRecord) : null;
  }

  async save(record: DeletionRequestRecord): Promise<void> {
    this.saveCount += 1;
    this.records.set(record.subjectHash, JSON.stringify(record));
  }
}
