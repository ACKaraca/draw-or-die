/**
 * In-memory stand-in for Appwrite TablesDB used by payment tests. It mimics the parts the
 * Stripe/promo code relies on: unique row ids, the unique `stripe_events.event_id` index,
 * bounded atomic increments/decrements, staged transactions and query filtering.
 * `failOnce` injects a failure into the next matching call.
 */

type Row = Record<string, unknown> & { $id: string };
/** Loose shape of the TablesDB object-style params the production code passes. */
type Params = {
  tableId: string;
  rowId: string;
  data: Record<string, unknown>;
  column: string;
  value?: number;
  max?: number;
  min?: number;
  transactionId?: string;
  queries?: string[];
  commit?: boolean;
  rollback?: boolean;
  ttl?: number;
};
type Op = { method: string; params: Params };
type Staged = { method: 'createRow' | 'updateRow' | 'incrementRowColumn' | 'decrementRowColumn'; params: Params };

export class AppwriteFakeError extends Error {
  code: number;
  type: string;

  constructor(code: number, type: string, message: string) {
    super(message);
    this.code = code;
    this.type = type;
  }
}

/** Query builder matching node-appwrite's JSON string format; used to mock `Query`. */
export const fakeQuery = {
  equal: (attribute: string, value: unknown) => JSON.stringify({ method: 'equal', attribute, values: Array.isArray(value) ? value : [value] }),
  notEqual: (attribute: string, value: unknown) => JSON.stringify({ method: 'notEqual', attribute, values: [value] }),
  isNull: (attribute: string) => JSON.stringify({ method: 'isNull', attribute }),
  or: (queries: string[]) => JSON.stringify({ method: 'or', values: queries.map((query) => JSON.parse(query)) }),
  limit: (value: number) => JSON.stringify({ method: 'limit', values: [value] }),
  orderAsc: (attribute: string) => JSON.stringify({ method: 'orderAsc', attribute }),
};

type ParsedQuery = { method: string; attribute?: string; values?: unknown[] };

const UNIQUE_COLUMNS: Record<string, string> = { stripe_events: 'event_id' };

function matches(row: Row, query: ParsedQuery): boolean {
  switch (query.method) {
    case 'equal':
      return (query.values ?? []).some((value) => row[query.attribute as string] === value);
    case 'notEqual':
      return row[query.attribute as string] !== null
        && row[query.attribute as string] !== undefined
        && row[query.attribute as string] !== (query.values ?? [])[0];
    case 'isNull':
      return row[query.attribute as string] === null || row[query.attribute as string] === undefined;
    case 'or':
      return (query.values as ParsedQuery[]).some((inner) => matches(row, inner));
    default:
      return true;
  }
}

export class FakeTables {
  tables = new Map<string, Map<string, Row>>();
  readonly calls: Op[] = [];
  private nextId = 1;
  private transactions = new Map<string, Staged[]>();
  private failures: Array<{ method: string; predicate: (params: Params) => boolean; error: Error }> = [];

  table(tableId: string): Map<string, Row> {
    let table = this.tables.get(tableId);
    if (!table) {
      table = new Map();
      this.tables.set(tableId, table);
    }
    return table;
  }

  rows(tableId: string): Row[] {
    return [...this.table(tableId).values()];
  }

  seed(tableId: string, row: Row): void {
    this.table(tableId).set(row.$id, { ...row });
  }

  failOnce(method: string, predicate: (params: Params) => boolean = () => true, error?: Error): void {
    this.failures.push({ method, predicate, error: error ?? new Error(`injected ${method} failure`) });
  }

  private record(method: string, params: Params): void {
    this.calls.push({ method, params });
    const index = this.failures.findIndex((failure) => failure.method === method && failure.predicate(params));
    if (index >= 0) {
      const [failure] = this.failures.splice(index, 1);
      throw failure.error;
    }
  }

  private assertCreatable(tableId: string, rowId: string, data: Record<string, unknown>): void {
    const table = this.table(tableId);
    if (table.has(rowId)) throw new AppwriteFakeError(409, 'row_already_exists', 'Row with the requested ID already exists.');
    const uniqueColumn = UNIQUE_COLUMNS[tableId];
    if (uniqueColumn && [...table.values()].some((row) => row[uniqueColumn] === data[uniqueColumn])) {
      throw new AppwriteFakeError(409, 'row_already_exists', 'Document with the requested unique value already exists.');
    }
  }

  private getExisting(tableId: string, rowId: string): Row {
    const row = this.table(tableId).get(rowId);
    if (!row) throw new AppwriteFakeError(404, 'row_not_found', 'Row with the requested ID could not be found.');
    return row;
  }

  private applyIncrement(params: Params, sign: 1 | -1): Row {
    const row = this.getExisting(params.tableId, params.rowId);
    const current = Number(row[params.column] ?? 0);
    const next = current + sign * Number(params.value ?? 1);
    if (sign === 1 && params.max !== undefined && params.max !== null && next > params.max) {
      throw new AppwriteFakeError(400, 'column_value_limit_exceeded', 'Value exceeds maximum');
    }
    if (sign === -1 && params.min !== undefined && params.min !== null && next < params.min) {
      throw new AppwriteFakeError(400, 'column_value_limit_exceeded', 'Value below minimum');
    }
    row[params.column] = next;
    return { ...row };
  }

  async createRow(params: Params): Promise<Row> {
    this.record('createRow', params);
    const rowId = params.rowId === 'unique()' ? `row_${this.nextId++}` : params.rowId;
    if (params.transactionId) {
      this.stage(params.transactionId, { method: 'createRow', params: { ...params, rowId } });
      return { $id: rowId, ...params.data };
    }
    this.assertCreatable(params.tableId, rowId, params.data);
    const row: Row = { $id: rowId, $createdAt: new Date().toISOString(), ...params.data };
    this.table(params.tableId).set(rowId, row);
    return { ...row };
  }

  async getRow(params: Params): Promise<Row> {
    this.record('getRow', params);
    return { ...this.getExisting(params.tableId, params.rowId) };
  }

  async listRows(params: Params): Promise<{ total: number; rows: Row[] }> {
    this.record('listRows', params);
    const queries = ((params.queries ?? []) as string[]).map((query) => JSON.parse(query) as ParsedQuery);
    const limit = queries.find((query) => query.method === 'limit')?.values?.[0] as number | undefined;
    const filtered = this.rows(params.tableId).filter((row) => queries.every((query) => matches(row, query)));
    return { total: filtered.length, rows: filtered.slice(0, limit ?? 25).map((row) => ({ ...row })) };
  }

  async updateRow(params: Params): Promise<Row> {
    this.record('updateRow', params);
    if (params.transactionId) {
      this.stage(params.transactionId, { method: 'updateRow', params });
      return { $id: params.rowId };
    }
    const row = this.getExisting(params.tableId, params.rowId);
    Object.assign(row, params.data);
    return { ...row };
  }

  async deleteRow(params: Params): Promise<Record<string, never>> {
    this.record('deleteRow', params);
    this.getExisting(params.tableId, params.rowId);
    this.table(params.tableId).delete(params.rowId);
    return {};
  }

  async incrementRowColumn(params: Params): Promise<Row> {
    this.record('incrementRowColumn', params);
    if (params.transactionId) {
      this.stage(params.transactionId, { method: 'incrementRowColumn', params });
      return { $id: params.rowId };
    }
    return this.applyIncrement(params, 1);
  }

  async decrementRowColumn(params: Params): Promise<Row> {
    this.record('decrementRowColumn', params);
    if (params.transactionId) {
      this.stage(params.transactionId, { method: 'decrementRowColumn', params });
      return { $id: params.rowId };
    }
    return this.applyIncrement(params, -1);
  }

  async createTransaction(params: Partial<Params> = {}): Promise<{ $id: string }> {
    this.record('createTransaction', params as Params);
    const id = `tx_${this.nextId++}`;
    this.transactions.set(id, []);
    return { $id: id };
  }

  private stage(transactionId: string, op: Staged): void {
    const staged = this.transactions.get(transactionId);
    if (!staged) throw new AppwriteFakeError(404, 'transaction_not_found', 'Transaction not found');
    staged.push(op);
  }

  async updateTransaction(params: Params): Promise<{ $id: string }> {
    this.record('updateTransaction', params);
    const transactionId = params.transactionId ?? '';
    const staged = this.transactions.get(transactionId);
    if (!staged) throw new AppwriteFakeError(404, 'transaction_not_found', 'Transaction not found');
    this.transactions.delete(transactionId);
    if (!params.commit) return { $id: transactionId };

    // All-or-nothing: work on a snapshot and swap it in only if every operation succeeds.
    const snapshot = new Map([...this.tables].map(([id, table]) => [id, new Map([...table].map(([rowId, row]) => [rowId, { ...row }]))]));
    const live = this.tables;
    this.tables = snapshot;
    try {
      for (const op of staged) {
        const rest = op.params;
        if (op.method === 'createRow') {
          this.assertCreatable(rest.tableId, rest.rowId, rest.data);
          this.table(rest.tableId).set(rest.rowId, { $id: rest.rowId, ...rest.data });
        } else if (op.method === 'updateRow') {
          Object.assign(this.getExisting(rest.tableId, rest.rowId), rest.data);
        } else if (op.method === 'incrementRowColumn') {
          this.applyIncrement(rest, 1);
        } else {
          this.applyIncrement(rest, -1);
        }
      }
    } catch (error) {
      this.tables = live;
      throw error;
    }
    return { $id: transactionId };
  }
}
