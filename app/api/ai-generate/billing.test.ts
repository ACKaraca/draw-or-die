/**
 * @jest-environment node
 */
import {
  openAiBilling,
  resetLedgerAvailabilityForTests,
  resolveOperationId,
} from '@/app/api/ai-generate/billing';
import { createAppwriteLedgerStore, getOperationStatus, reconcileShadowProjection } from '@/lib/rapido-ledger';
import { FakeTables } from '@/lib/test-utils/fake-appwrite-tables';

let mockFakeTables = new FakeTables();
const mockUpdateProfileRowById = jest.fn();

jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_DATABASE_ID: 'db',
  APPWRITE_TABLE_PROFILES_ID: 'profiles',
  APPWRITE_TABLE_RAPIDO_LEDGER_ID: 'rapido_ledger_entries',
  getAdminTables: () => mockFakeTables,
  getProfileRowForUser: jest.fn(),
  updateProfileRowById: (...args: unknown[]) => mockUpdateProfileRowById(...args),
  updateProfileById: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logServerError: jest.fn(),
  logServerInfo: jest.fn(),
}));

const USER = 'user_1';
const ROW = 'row_1';

function seedProfile(pens: number): void {
  mockFakeTables.seed('profiles', { $id: ROW, rapido_pens: pens, rapido_fraction_cents: 0 });
}

function counterCents(): number {
  const row = mockFakeTables.data.get('profiles')?.get(ROW);
  return Number(row?.rapido_pens) * 100 + Number(row?.rapido_fraction_cents);
}

function open(operationId: string, amountCents: number) {
  return openAiBilling({
    userId: USER,
    profileRowId: ROW,
    operationId,
    operation: 'SINGLE_JURY',
    requestId: 'req_1',
    amountCents,
    knownBalanceCents: counterCents(),
  });
}

beforeEach(() => {
  mockFakeTables = new FakeTables();
  resetLedgerAvailabilityForTests();
  mockUpdateProfileRowById.mockReset();
  delete process.env.RAPIDO_LEDGER_MODE;
});

describe('resolveOperationId', () => {
  it('accepts a well-formed client key, generates one when absent, rejects malformed input', () => {
    expect(resolveOperationId('op_client_123')).toEqual({ ok: true, operationId: 'op_client_123', isClientSupplied: true });
    expect(resolveOperationId(undefined)).toEqual(expect.objectContaining({ ok: true, isClientSupplied: false }));
    expect(resolveOperationId('short')).toEqual({ ok: false });
    expect(resolveOperationId('has space in it')).toEqual({ ok: false });
    expect(resolveOperationId(42)).toEqual({ ok: false });
  });
});

describe('openAiBilling', () => {
  it('reserves before the AI call and settles the accepted result once', async () => {
    seedProfile(10);
    const opened = await open('op_success1', 400);
    if (opened.kind !== 'opened') throw new Error('expected an open session');
    expect(opened.session.mode).toBe('ledger');
    expect(counterCents()).toBe(600);

    await expect(opened.session.settle(400, 'reject')).resolves.toEqual({ kind: 'settled', balanceCents: 600 });
    expect(opened.session.isOpen).toBe(false);
    await opened.session.void('late_failure');
    expect(counterCents()).toBe(600);
    expect((await getOperationStatus(createAppwriteLedgerStore(), USER, 'op_success1')).state).toBe('settled');
  });

  it('voids a failed operation so it costs zero Rapido', async () => {
    seedProfile(10);
    const opened = await open('op_failure1', 400);
    if (opened.kind !== 'opened') throw new Error('expected an open session');
    await opened.session.void('provider_failure');

    expect(counterCents()).toBe(1000);
    const entries = await createAppwriteLedgerStore().listEntries(USER);
    expect(entries.map((entry) => entry.kind).sort()).toEqual(['reserve', 'void']);
    const report = reconcileShadowProjection({ userId: USER, legacyCounterCents: 1000, entries });
    expect(report.projection.spentCents).toBe(0);
    expect(report.projection.availableCents).toBe(0);
  });

  it('turns a replayed operation id into a duplicate without a second charge', async () => {
    seedProfile(10);
    const first = await open('op_replay01', 400);
    if (first.kind !== 'opened') throw new Error('expected an open session');
    await first.session.settle(400, 'reject');

    await expect(open('op_replay01', 400)).resolves.toEqual({ kind: 'duplicate', state: 'settled' });
    expect(counterCents()).toBe(600);
  });

  it('reports insufficient balance without reserving anything', async () => {
    seedProfile(3);
    await expect(open('op_too_poor', 400)).resolves.toEqual({ kind: 'insufficient' });
    expect(counterCents()).toBe(300);
  });

  it('keeps an unaffordable top-up open so the route can void it', async () => {
    seedProfile(1);
    const opened = await open('op_revision', 100);
    if (opened.kind !== 'opened') throw new Error('expected an open session');
    await expect(opened.session.settle(200, 'reject')).resolves.toEqual({ kind: 'insufficient' });
    expect(opened.session.isOpen).toBe(true);
    await opened.session.void('insufficient_top_up');
    expect(counterCents()).toBe(100);
  });

  it('falls back to the legacy charge-after-success path when the journal table is missing', async () => {
    seedProfile(10);
    mockFakeTables.missingTables.add('rapido_ledger_entries');
    const opened = await open('op_no_table', 400);
    if (opened.kind !== 'opened') throw new Error('expected an open session');

    expect(opened.session.mode).toBe('legacy');
    expect(counterCents()).toBe(1000);
    mockFakeTables.data.get('profiles')?.set(ROW, { $id: ROW, rapido_pens: 10, rapido_fraction_cents: 0 });
    await opened.session.void('provider_failure');
    expect(counterCents()).toBe(1000);
  });

  it('honours the RAPIDO_LEDGER_MODE=off kill switch', async () => {
    seedProfile(10);
    process.env.RAPIDO_LEDGER_MODE = 'off';
    const opened = await open('op_switched', 400);
    if (opened.kind !== 'opened') throw new Error('expected an open session');
    expect(opened.session.mode).toBe('legacy');
    expect(mockFakeTables.calls.filter((call) => call.tableId === 'rapido_ledger_entries')).toEqual([]);
  });
});
