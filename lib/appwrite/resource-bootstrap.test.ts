type TablesMock = Record<string, jest.Mock>;

const mockTables: TablesMock = {};
const mockStorage: TablesMock = {};

jest.mock('node-appwrite', () => ({
  ID: { unique: jest.fn(() => 'row_1') },
  Query: {
    equal: jest.fn(() => 'equal'),
    limit: jest.fn(() => 'limit'),
  },
  Permission: {
    read: jest.fn(() => 'read'),
    create: jest.fn(() => 'create'),
    update: jest.fn(() => 'update'),
    delete: jest.fn(() => 'delete'),
  },
  Role: {
    any: jest.fn(() => 'any'),
    users: jest.fn(() => 'users'),
  },
  Compression: { Gzip: 'gzip' },
  OrderBy: { Asc: 'asc', Desc: 'desc' },
  TablesDBIndexType: { Key: 'key', Unique: 'unique', Fulltext: 'fulltext' },
  TablesDB: jest.fn(() => mockTables),
  Storage: jest.fn(() => mockStorage),
}));

jest.mock('@/lib/appwrite/server', () => {
  const ids = [
    'APPWRITE_BUCKET_GALLERY_ID',
    'APPWRITE_TABLE_BILLING_EVENTS_ID',
    'APPWRITE_DATABASE_ID',
    'APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID',
    'APPWRITE_TABLE_MEMORY_SNIPPETS_ID',
    'APPWRITE_TABLE_ANALYSIS_HISTORY_ID',
    'APPWRITE_TABLE_REFERENCES_ID',
    'APPWRITE_TABLE_GALLERY_ID',
    'APPWRITE_TABLE_MENTOR_CHATS_ID',
    'APPWRITE_TABLE_MENTOR_MESSAGES_ID',
    'APPWRITE_TABLE_FEEDBACK_ID',
    'APPWRITE_TABLE_PROFILES_ID',
    'APPWRITE_TABLE_PROMO_CODES_ID',
    'APPWRITE_TABLE_PROMO_REDEMPTIONS_ID',
    'APPWRITE_TABLE_STRIPE_EVENTS_ID',
    'APPWRITE_TABLE_FEATURE_FLAGS_ID',
  ];
  return {
    ...Object.fromEntries(ids.map((id) => [id, id.toLowerCase()])),
    createAdminClient: jest.fn(() => ({})),
  };
});

const NOT_FOUND = Object.assign(new Error('not found'), { code: 404 });

type SchemaKey = { tableId: string; key: string };

function resetMocks(): void {
  for (const target of [mockTables, mockStorage]) {
    for (const key of Object.keys(target)) delete target[key];
  }

  mockTables.get = jest.fn().mockResolvedValue({});
  mockTables.getTable = jest.fn().mockResolvedValue({});
  mockTables.getColumn = jest.fn().mockResolvedValue({});
  mockTables.getIndex = jest.fn().mockResolvedValue({});
  mockTables.listRows = jest.fn().mockResolvedValue({ rows: [{ $id: 'flag' }] });
  mockTables.listTables = jest.fn().mockRejectedValue(new Error('list unavailable'));
  mockTables.listColumns = jest.fn().mockRejectedValue(new Error('list unavailable'));
  mockTables.listIndexes = jest.fn().mockRejectedValue(new Error('list unavailable'));
  for (const method of [
    'createTable',
    'createStringColumn',
    'createBooleanColumn',
    'createIntegerColumn',
    'createDatetimeColumn',
    'createIndex',
    'createRow',
  ]) {
    mockTables[method] = jest.fn().mockResolvedValue({});
  }

  mockStorage.getBucket = jest.fn().mockResolvedValue({
    name: 'Gallery',
    allowedFileExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    maximumFileSize: 35 * 1024 * 1024,
    enabled: true,
    fileSecurity: false,
    $permissions: ['read'],
  });
  mockStorage.updateBucket = jest.fn().mockResolvedValue({});
}

async function loadBootstrap() {
  let mod: typeof import('@/lib/appwrite/resource-bootstrap') | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual<typeof import('@/lib/appwrite/resource-bootstrap')>('@/lib/appwrite/resource-bootstrap');
  });
  return mod!;
}

async function captureExistingSchema(): Promise<{ tableIds: string[]; columns: SchemaKey[]; indexes: SchemaKey[] }> {
  resetMocks();
  const { ensureCoreAppwriteResources } = await loadBootstrap();
  await ensureCoreAppwriteResources();

  const toKeys = (mock: jest.Mock): SchemaKey[] =>
    mock.mock.calls.map(([params]) => ({ tableId: params.tableId, key: params.key }));

  return {
    tableIds: mockTables.getTable.mock.calls.map(([params]) => params.tableId),
    columns: toKeys(mockTables.getColumn),
    indexes: toKeys(mockTables.getIndex),
  };
}

function mockListsFrom(schema: { tableIds: string[]; columns: SchemaKey[]; indexes: SchemaKey[] }, skipColumn?: SchemaKey) {
  mockTables.listTables = jest.fn().mockResolvedValue({
    tables: schema.tableIds.map((id) => ({ $id: id })),
  });
  mockTables.listColumns = jest.fn(async ({ tableId }: { tableId: string }) => ({
    columns: schema.columns
      .filter((entry) => entry.tableId === tableId)
      .filter((entry) => !(skipColumn && entry.tableId === skipColumn.tableId && entry.key === skipColumn.key))
      .map((entry) => ({ key: entry.key })),
  }));
  mockTables.listIndexes = jest.fn(async ({ tableId }: { tableId: string }) => ({
    indexes: schema.indexes
      .filter((entry) => entry.tableId === tableId)
      .map((entry) => ({ key: entry.key })),
  }));
}

describe('ensureCoreAppwriteResources', () => {
  it('falls back to per-key lookups when list endpoints are unavailable', async () => {
    const schema = await captureExistingSchema();

    expect(schema.tableIds.length).toBeGreaterThan(10);
    expect(schema.columns.length).toBeGreaterThan(100);
    expect(mockTables.createStringColumn).not.toHaveBeenCalled();
  });

  it('uses list snapshots instead of one lookup per column and index', async () => {
    const schema = await captureExistingSchema();
    resetMocks();
    mockListsFrom(schema);

    const { ensureCoreAppwriteResources } = await loadBootstrap();
    await ensureCoreAppwriteResources();

    expect(mockTables.getTable).not.toHaveBeenCalled();
    expect(mockTables.getColumn).not.toHaveBeenCalled();
    expect(mockTables.getIndex).not.toHaveBeenCalled();
    expect(mockTables.listColumns.mock.calls.length).toBe(new Set(schema.tableIds).size);
  });

  it('still creates a column that is missing from the snapshot', async () => {
    const schema = await captureExistingSchema();
    const missing = schema.columns.find((entry) => entry.tableId === 'appwrite_table_profiles_id' && entry.key === 'email');
    expect(missing).toBeDefined();

    resetMocks();
    mockListsFrom(schema, missing);
    mockTables.getColumn = jest.fn().mockRejectedValue(NOT_FOUND);

    const { ensureCoreAppwriteResources } = await loadBootstrap();
    await ensureCoreAppwriteResources();

    expect(mockTables.getColumn).toHaveBeenCalledTimes(1);
    expect(mockTables.createStringColumn).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: 'appwrite_table_profiles_id', key: 'email' }),
    );
  });

  it('reuses a successful check instead of re-validating on the next request', async () => {
    resetMocks();
    const { ensureCoreAppwriteResources } = await loadBootstrap();

    await ensureCoreAppwriteResources();
    const callsAfterFirstRun = mockTables.getColumn.mock.calls.length;
    await ensureCoreAppwriteResources();

    expect(mockTables.getColumn.mock.calls.length).toBe(callsAfterFirstRun);
  });
});
