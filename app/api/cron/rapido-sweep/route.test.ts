/**
 * @jest-environment node
 */
import { GET } from '@/app/api/cron/rapido-sweep/route';
import { createAppwriteLedgerStore, getOperationStatus, reserve } from '@/lib/rapido-ledger';
import { createProfileRapidoCounter } from '@/lib/rapido-balance';
import { FakeTables } from '@/lib/test-utils/fake-appwrite-tables';

let mockFakeTables = new FakeTables();

jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_DATABASE_ID: 'db',
  APPWRITE_TABLE_PROFILES_ID: 'profiles',
  APPWRITE_TABLE_RAPIDO_LEDGER_ID: 'rapido_ledger_entries',
  getAdminTables: () => mockFakeTables,
  getProfileRowForUser: async (userId: string) => (userId === 'user_1' ? { $id: 'row_1' } : null),
}));

jest.mock('@/lib/logger', () => ({
  logServerError: jest.fn(),
  logServerInfo: jest.fn(),
}));

function request(authorization?: string): Request {
  return new Request('https://drawordie.app/api/cron/rapido-sweep', {
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  mockFakeTables = new FakeTables();
  mockFakeTables.seed('profiles', { $id: 'row_1', rapido_pens: 10, rapido_fraction_cents: 0 });
  process.env.CRON_SECRET = 'test-cron-secret';
});

afterAll(() => {
  delete process.env.CRON_SECRET;
});

describe('GET /api/cron/rapido-sweep', () => {
  it('rejects missing or wrong credentials, and refuses to run without CRON_SECRET', async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request('Bearer wrong'))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await GET(request('Bearer '))).status).toBe(401);
    expect((await GET(request('Bearer undefined'))).status).toBe(401);
    expect(mockFakeTables.calls).toEqual([]);
  });

  it('voids an expired reservation and returns the value to the counter', async () => {
    const deps = {
      store: createAppwriteLedgerStore(),
      counter: createProfileRapidoCounter({ userId: 'user_1', profileRowId: 'row_1' }),
    };
    await reserve(deps, { userId: 'user_1', operationId: 'op_expired_1', operation: 'SINGLE_JURY', amountCents: 400, leaseMs: -1 });
    await reserve(deps, { userId: 'user_1', operationId: 'op_live_0001', operation: 'SINGLE_JURY', amountCents: 100 });

    const response = await GET(request('Bearer test-cron-secret'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', usersScanned: 1, voided: 1 });
    expect((await getOperationStatus(deps.store, 'user_1', 'op_expired_1')).state).toBe('voided');
    expect((await getOperationStatus(deps.store, 'user_1', 'op_live_0001')).state).toBe('open');
    expect(mockFakeTables.data.get('profiles')?.get('row_1')?.rapido_pens).toBe(9);
  });

  it('reports ledger_unavailable while the journal table is not provisioned', async () => {
    mockFakeTables.missingTables.add('rapido_ledger_entries');
    const response = await GET(request('Bearer test-cron-secret'));
    expect(await response.json()).toEqual({ status: 'ledger_unavailable' });
  });
});
