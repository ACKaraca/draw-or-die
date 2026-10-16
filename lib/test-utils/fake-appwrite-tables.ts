import { randomInt } from 'node:crypto';

export type FakeRow = Record<string, unknown> & { $id: string };
export type FakeCall = { method: string; tableId: string };

// In-memory stand-in for the Appwrite TablesDB atomic primitives used by lib/rapido-balance.ts and
// the ledger store. Each call yields to the event loop a random number of times before acting, so
// concurrent callers interleave the way independent HTTP requests would; the mutation itself is
// atomic, like Appwrite's conditional increment/decrement and create-with-id.
export class FakeTables {
  readonly data = new Map<string, Map<string, FakeRow>>();
  readonly calls: FakeCall[] = [];
  lowestPens = Number.POSITIVE_INFINITY;
  /** Tables that behave as "not provisioned yet" (every call fails with table_not_found). */
  readonly missingTables = new Set<string>();

  private table(tableId: string): Map<string, FakeRow> {
    if (this.missingTables.has(tableId)) {
      throw Object.assign(new Error('Table with the requested ID could not be found.'), {
        code: 404,
        type: 'table_not_found',
      });
    }
    let table = this.data.get(tableId);
    if (!table) {
      table = new Map();
      this.data.set(tableId, table);
    }
    return table;
  }

  private async yieldRandomly(): Promise<void> {
    const hops = randomInt(4);
    for (let i = 0; i < hops; i += 1) await Promise.resolve();
  }

  private mustGet(tableId: string, rowId: string): FakeRow {
    const row = this.table(tableId).get(rowId);
    if (!row) throw Object.assign(new Error('Row not found'), { code: 404, type: 'row_not_found' });
    return row;
  }

  seed(tableId: string, row: FakeRow): void {
    this.table(tableId).set(row.$id, { ...row });
  }

  async decrementRowColumn(params: { tableId: string; rowId: string; column: string; value?: number; min?: number }) {
    this.calls.push({ method: 'decrementRowColumn', tableId: params.tableId });
    await this.yieldRandomly();
    const row = this.mustGet(params.tableId, params.rowId);
    const next = Number(row[params.column]) - (params.value ?? 1);
    if (params.min !== undefined && next < params.min) {
      throw Object.assign(new Error('Value below minimum'), { code: 400, type: 'row_invalid_structure' });
    }
    row[params.column] = next;
    if (params.column === 'rapido_pens') this.lowestPens = Math.min(this.lowestPens, next);
    return { ...row };
  }

  async incrementRowColumn(params: { tableId: string; rowId: string; column: string; value?: number; max?: number }) {
    this.calls.push({ method: 'incrementRowColumn', tableId: params.tableId });
    await this.yieldRandomly();
    const row = this.mustGet(params.tableId, params.rowId);
    const next = Number(row[params.column]) + (params.value ?? 1);
    if (params.max !== undefined && next > params.max) {
      throw Object.assign(new Error('Value above maximum'), { code: 400, type: 'row_invalid_structure' });
    }
    row[params.column] = next;
    return { ...row };
  }

  async createRow(params: { tableId: string; rowId: string; data: Record<string, unknown> }) {
    this.calls.push({ method: 'createRow', tableId: params.tableId });
    await this.yieldRandomly();
    const table = this.table(params.tableId);
    if (table.has(params.rowId)) {
      throw Object.assign(new Error('Row with the requested ID already exists'), { code: 409, type: 'row_already_exists' });
    }
    const row = { ...params.data, $id: params.rowId };
    table.set(params.rowId, row);
    return { ...row };
  }

  async getRow(params: { tableId: string; rowId: string }) {
    this.calls.push({ method: 'getRow', tableId: params.tableId });
    await this.yieldRandomly();
    return { ...this.mustGet(params.tableId, params.rowId) };
  }

  async listRows(params: { tableId: string; queries: string[] }) {
    this.calls.push({ method: 'listRows', tableId: params.tableId });
    const parsed = params.queries.map((query) => JSON.parse(query) as { method: string; attribute?: string; values: unknown[] });
    let rows = [...this.table(params.tableId).values()];
    for (const query of parsed) {
      if (query.method === 'equal' && query.attribute) {
        rows = rows.filter((row) => query.values.includes(row[query.attribute as string]));
      }
    }
    const cursor = parsed.find((query) => query.method === 'cursorAfter')?.values[0];
    if (cursor) rows = rows.slice(rows.findIndex((row) => row.$id === cursor) + 1);
    const limit = Number(parsed.find((query) => query.method === 'limit')?.values[0] ?? 25);
    return { total: rows.length, rows: rows.slice(0, limit).map((row) => ({ ...row })) };
  }

  async updateRow(params: { tableId: string }) {
    this.calls.push({ method: 'updateRow', tableId: params.tableId });
    throw new Error('updateRow is not expected in these tests');
  }

  async deleteRow(params: { tableId: string }) {
    this.calls.push({ method: 'deleteRow', tableId: params.tableId });
    throw new Error('deleteRow is not expected in these tests');
  }
}
