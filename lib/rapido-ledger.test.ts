/**
 * @jest-environment node
 */
import {
  buildOpeningEntry,
  correct,
  createAppwriteLedgerStore,
  expire,
  getOperationStatus,
  grant,
  ledgerEntryId,
  planOpeningEntry,
  projectBalance,
  reconcileShadowProjection,
  refund,
  reserve,
  settle,
  voidExpiredReservations,
  voidReservation,
  type RapidoLedgerDeps,
} from '@/lib/rapido-ledger';
import { createProfileRapidoCounter } from '@/lib/rapido-balance';
import { FakeTables, type FakeRow } from '@/lib/test-utils/fake-appwrite-tables';

let mockFakeTables = new FakeTables();

jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_DATABASE_ID: 'db',
  APPWRITE_TABLE_PROFILES_ID: 'profiles',
  APPWRITE_TABLE_RAPIDO_LEDGER_ID: 'rapido_ledger_entries',
  getAdminTables: () => mockFakeTables,
  getProfileRowForUser: jest.fn(),
  updateProfileRowById: jest.fn(),
  updateProfileById: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logServerError: jest.fn(),
  logServerInfo: jest.fn(),
}));

const USER = 'user_1';
const ROW = 'profile_row_1';
const LEDGER = 'rapido_ledger_entries';

function seedProfile(pens: number, fractionCents = 0): void {
  mockFakeTables.seed('profiles', { $id: ROW, user_id: USER, rapido_pens: pens, rapido_fraction_cents: fractionCents });
}

function counterCents(): number {
  const row = mockFakeTables.data.get('profiles')?.get(ROW);
  return Number(row?.rapido_pens) * 100 + Number(row?.rapido_fraction_cents);
}

function makeDeps(): RapidoLedgerDeps {
  return {
    store: createAppwriteLedgerStore(),
    counter: createProfileRapidoCounter({ userId: USER, profileRowId: ROW }),
  };
}

async function backfillOpening(deps: RapidoLedgerDeps): Promise<void> {
  await deps.store.appendEntry(buildOpeningEntry({
    userId: USER,
    legacyCounterCents: counterCents(),
    actor: 'backfill-test',
    occurredAt: new Date(0).toISOString(),
  }));
}

async function reconcile(deps: RapidoLedgerDeps) {
  return reconcileShadowProjection({
    userId: USER,
    legacyCounterCents: counterCents(),
    entries: await deps.store.listEntries(USER),
  });
}

function opId(index: number): string {
  return `op_${String(index).padStart(6, '0')}`;
}

beforeEach(() => {
  mockFakeTables = new FakeTables();
});

describe('rapido ledger concurrency', () => {
  it('100 concurrent reservations never overspend, double spend or go negative', async () => {
    seedProfile(15);
    const deps = makeDeps();
    await backfillOpening(deps);

    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) => reserve(deps, {
        userId: USER,
        operationId: opId(i),
        operation: 'SINGLE_JURY',
        amountCents: 400,
      })),
    );

    const reserved = results.filter((r) => r.kind === 'reserved');
    expect(reserved).toHaveLength(3);
    expect(results.filter((r) => r.kind === 'insufficient')).toHaveLength(97);
    expect(counterCents()).toBe(300);
    expect(mockFakeTables.lowestPens).toBeGreaterThanOrEqual(0);

    const report = await reconcile(deps);
    expect(report.differenceCents).toBe(0);
    expect(report.isReconciled).toBe(true);
    expect(report.projection.reservedCents).toBe(1200);
  });

  it('never loses a grant that lands while 100 reservations race', async () => {
    seedProfile(10);
    const deps = makeDeps();
    await backfillOpening(deps);

    const reservations = Array.from({ length: 100 }, (_, i) => reserve(deps, {
      userId: USER,
      operationId: opId(i),
      operation: 'SINGLE_JURY',
      amountCents: 150,
    }));
    const grants = Array.from({ length: 20 }, (_, i) => grant(deps, {
      userId: USER,
      sourceId: `evt_${i}`,
      kind: 'purchase',
      bucket: 'purchased',
      amountCents: 250,
      reason: 'rapido_pack',
    }));
    const [reserveResults] = await Promise.all([Promise.all(reservations), Promise.all(grants)]);

    const reservedCents = reserveResults.filter((r) => r.kind === 'reserved').length * 150;
    expect(counterCents()).toBe(1000 + 20 * 250 - reservedCents);
    expect(counterCents()).toBeGreaterThanOrEqual(0);
    expect(mockFakeTables.lowestPens).toBeGreaterThanOrEqual(0);

    const report = await reconcile(deps);
    expect(report.differenceCents).toBe(0);
    expect(report.isReconciled).toBe(true);
  });

  it('settles and voids fractional amounts concurrently without drift', async () => {
    seedProfile(50, 37);
    const deps = makeDeps();
    await backfillOpening(deps);

    const ops = Array.from({ length: 100 }, (_, i) => opId(i));
    await Promise.all(ops.map((id) => reserve(deps, { userId: USER, operationId: id, operation: 'AI_MENTOR', amountCents: 25 })));
    await Promise.all(ops.map((id, i) => (i % 3 === 0
      ? voidReservation(deps, { userId: USER, operationId: id, reason: 'provider_failure' })
      : settle(deps, { userId: USER, operationId: id, actualCents: i % 2 === 0 ? 7 : 63, shortfall: 'clamp' }))));

    const report = await reconcile(deps);
    expect(report.differenceCents).toBe(0);
    expect(report.isReconciled).toBe(true);
    expect(report.projection.openReservations).toEqual([]);
    expect(Number(mockFakeTables.data.get('profiles')?.get(ROW)?.rapido_fraction_cents)).toBeLessThan(100);
  });
});

describe('rapido ledger idempotency', () => {
  it('a replayed operation id reserves and settles at most once', async () => {
    seedProfile(20);
    const deps = makeDeps();
    await backfillOpening(deps);

    const reserveResults = await Promise.all(Array.from({ length: 10 }, () => reserve(deps, {
      userId: USER,
      operationId: 'op_replayed',
      operation: 'SINGLE_JURY',
      amountCents: 400,
    })));
    expect(reserveResults.filter((r) => r.kind === 'reserved')).toHaveLength(1);
    expect(reserveResults.filter((r) => r.kind === 'duplicate')).toHaveLength(9);
    expect(counterCents()).toBe(1600);

    const settleResults = await Promise.all(Array.from({ length: 10 }, () => settle(deps, {
      userId: USER,
      operationId: 'op_replayed',
      actualCents: 400,
    })));
    expect(settleResults.filter((r) => r.kind === 'settled')).toHaveLength(1);
    expect(counterCents()).toBe(1600);

    await expect(voidReservation(deps, { userId: USER, operationId: 'op_replayed', reason: 'late' }))
      .resolves.toEqual({ kind: 'already_closed', state: 'settled' });
    await expect(reserve(deps, { userId: USER, operationId: 'op_replayed', operation: 'SINGLE_JURY', amountCents: 400 }))
      .resolves.toEqual({ kind: 'duplicate', state: 'settled' });

    const report = await reconcile(deps);
    expect(report.isReconciled).toBe(true);
    expect(report.projection.spentCents).toBe(400);
  });

  it('a concurrent settle and void race leaves exactly one close entry', async () => {
    seedProfile(10);
    const deps = makeDeps();
    await reserve(deps, { userId: USER, operationId: 'op_race_1', operation: 'DEFENSE', amountCents: 400 });

    const [settled, voided] = await Promise.all([
      settle(deps, { userId: USER, operationId: 'op_race_1', actualCents: 400 }),
      voidReservation(deps, { userId: USER, operationId: 'op_race_1', reason: 'cancelled' }),
    ]);

    const winners = [settled.kind, voided.kind].filter((kind) => kind === 'settled' || kind === 'voided');
    expect(winners).toHaveLength(1);
    expect(counterCents()).toBe(settled.kind === 'settled' ? 600 : 1000);
    const status = await getOperationStatus(deps.store, USER, 'op_race_1');
    expect(status.state).toBe(settled.kind === 'settled' ? 'settled' : 'voided');
  });

  it('rejects invalid operation ids', async () => {
    seedProfile(10);
    await expect(reserve(makeDeps(), { userId: USER, operationId: 'bad id!', operation: 'X', amountCents: 1 }))
      .rejects.toThrow('operationId is invalid');
  });
});

describe('rapido ledger append-only journal', () => {
  it('settle, void, expiry, refund and correction all append entries and never update or delete', async () => {
    seedProfile(10);
    const deps = makeDeps();
    await backfillOpening(deps);
    await grant(deps, { userId: USER, sourceId: 'allowance_2026_10', kind: 'grant', bucket: 'allowance', amountCents: 2000, reason: 'monthly' });

    await reserve(deps, { userId: USER, operationId: 'op_settle_1', operation: 'SINGLE_JURY', amountCents: 400 });
    await settle(deps, { userId: USER, operationId: 'op_settle_1', actualCents: 400 });
    await reserve(deps, { userId: USER, operationId: 'op_void_01', operation: 'SINGLE_JURY', amountCents: 400 });
    await voidReservation(deps, { userId: USER, operationId: 'op_void_01', reason: 'invalid_ai_result' });
    await refund(deps, { userId: USER, operationId: 'op_settle_1', refundId: 'r1', amountCents: 100, reason: 'support', actor: 'admin@x' });
    await expire(deps, { userId: USER, expiryId: 'allowance_2026_10_end', bucket: 'allowance', amountCents: 500, reason: 'period_end' });
    await correct(deps, {
      userId: USER,
      correctionId: 'corr_1',
      bucket: 'legacy',
      deltaCents: -50,
      reason: 'duplicate grant',
      actor: 'ops@x',
      approvedBy: 'owner@x',
    });

    const entries = await deps.store.listEntries(USER);
    expect(entries.map((e) => e.kind).sort()).toEqual(
      ['correction', 'expiry', 'grant', 'opening', 'refund', 'reserve', 'reserve', 'settle', 'void'].sort(),
    );
    const ledgerMutations = mockFakeTables.calls.filter(
      (call) => call.tableId === LEDGER && (call.method === 'updateRow' || call.method === 'deleteRow'),
    );
    expect(ledgerMutations).toEqual([]);

    const report = await reconcile(deps);
    expect(report.differenceCents).toBe(0);
    expect(report.isReconciled).toBe(true);
  });

  it('requires an actor, reason and approver for corrections', async () => {
    seedProfile(10);
    await expect(correct(makeDeps(), {
      userId: USER,
      correctionId: 'corr_2',
      bucket: 'legacy',
      deltaCents: 100,
      reason: 'x',
      actor: 'ops@x',
      approvedBy: '  ',
    })).rejects.toThrow('approvedBy is required');
  });

  it('refunds never exceed the settled spend', async () => {
    seedProfile(10);
    const deps = makeDeps();
    await reserve(deps, { userId: USER, operationId: 'op_refund1', operation: 'SINGLE_JURY', amountCents: 400 });
    await settle(deps, { userId: USER, operationId: 'op_refund1', actualCents: 400 });
    await expect(refund(deps, { userId: USER, operationId: 'op_refund1', refundId: 'a', amountCents: 500, reason: 'x', actor: 'y' }))
      .resolves.toEqual({ kind: 'not_refundable', refundableCents: 400 });
  });
});

describe('rapido ledger zero spend on failure', () => {
  it.each(['invalid_ai_result', 'provider_refusal', 'timeout', 'cancelled', 'provider_failure'])(
    'a %s operation closes with zero spend',
    async (reason) => {
      seedProfile(10);
      const deps = makeDeps();
      await backfillOpening(deps);
      await reserve(deps, { userId: USER, operationId: 'op_failing', operation: 'MULTI_JURY', amountCents: 1000 });
      expect(counterCents()).toBe(0);

      await expect(voidReservation(deps, { userId: USER, operationId: 'op_failing', reason }))
        .resolves.toEqual(expect.objectContaining({ kind: 'voided', releasedCents: 1000 }));

      expect(counterCents()).toBe(1000);
      const report = await reconcile(deps);
      expect(report.projection.spentCents).toBe(0);
      expect(report.isReconciled).toBe(true);
    },
  );

  it('voids reservations whose lease expired without a close', async () => {
    seedProfile(10);
    let now = new Date('2026-10-13T10:00:00Z');
    const deps: RapidoLedgerDeps = { ...makeDeps(), now: () => now };
    await reserve(deps, { userId: USER, operationId: 'op_crashed', operation: 'SINGLE_JURY', amountCents: 400, leaseMs: 60_000 });
    await reserve(deps, { userId: USER, operationId: 'op_running', operation: 'SINGLE_JURY', amountCents: 400, leaseMs: 600_000 });

    now = new Date('2026-10-13T10:05:00Z');
    await expect(voidExpiredReservations(deps, USER)).resolves.toEqual(['op_crashed']);
    expect(counterCents()).toBe(600);
  });

  it('rejects an unaffordable extra charge without closing, and clamps when asked', async () => {
    seedProfile(5);
    const deps = makeDeps();
    await reserve(deps, { userId: USER, operationId: 'op_extra_1', operation: 'REVISION_SAME', amountCents: 100 });
    await expect(settle(deps, { userId: USER, operationId: 'op_extra_1', actualCents: 900 }))
      .resolves.toEqual({ kind: 'insufficient', requiredExtraCents: 800 });
    expect((await getOperationStatus(deps.store, USER, 'op_extra_1')).state).toBe('open');

    await reserve(deps, { userId: USER, operationId: 'op_extra_2', operation: 'AI_MENTOR', amountCents: 0 });
    const clamped = await settle(deps, { userId: USER, operationId: 'op_extra_2', actualCents: 10_000, shortfall: 'clamp' });
    expect(clamped).toEqual(expect.objectContaining({ kind: 'settled', chargedCents: 400, shortfallCents: 9_600 }));
    expect(counterCents()).toBe(0);
  });
});

describe('rapido ledger projection and reconciliation', () => {
  it('keeps purchased and allowance value distinguishable through spend, refund and expiry', async () => {
    seedProfile(5);
    const deps = makeDeps();
    await backfillOpening(deps);
    await grant(deps, { userId: USER, sourceId: 'allowance_1', kind: 'grant', bucket: 'allowance', amountCents: 1000, reason: 'monthly' });
    await grant(deps, { userId: USER, sourceId: 'evt_pack_1', kind: 'purchase', bucket: 'purchased', amountCents: 2000, reason: 'pack' });

    await reserve(deps, { userId: USER, operationId: 'op_spend_1', operation: 'MULTI_JURY', amountCents: 1200 });
    await settle(deps, { userId: USER, operationId: 'op_spend_1', actualCents: 1200 });

    let projection = projectBalance(await deps.store.listEntries(USER));
    expect(projection.spentByBucket).toEqual({ allowance: 1000, promotional: 0, earned: 0, legacy: 200, purchased: 0 });
    expect(projection.buckets).toEqual({ allowance: 0, promotional: 0, earned: 0, legacy: 300, purchased: 2000 });

    await refund(deps, { userId: USER, operationId: 'op_spend_1', refundId: 'r1', amountCents: 300, reason: 'support', actor: 'ops' });
    projection = projectBalance(await deps.store.listEntries(USER));
    expect(projection.buckets).toEqual({ allowance: 100, promotional: 0, earned: 0, legacy: 500, purchased: 2000 });

    await expire(deps, { userId: USER, expiryId: 'allowance_1_end', bucket: 'allowance', amountCents: 1000, reason: 'period_end' });
    projection = projectBalance(await deps.store.listEntries(USER));
    expect(projection.buckets.allowance).toBe(0);
    expect(projection.buckets.purchased).toBe(2000);
    expect(projection.availableCents).toBe(counterCents());
  });

  it('flags a counter change that the journal does not explain', async () => {
    seedProfile(10);
    const deps = makeDeps();
    await backfillOpening(deps);
    const row = mockFakeTables.data.get('profiles')?.get(ROW) as FakeRow;
    row.rapido_pens = Number(row.rapido_pens) + 5;

    const report = await reconcile(deps);
    expect(report.differenceCents).toBe(500);
    expect(report.isReconciled).toBe(false);
  });

  it('backfills an opening that reconciles even when the runtime journaled first', async () => {
    seedProfile(12);
    const deps = makeDeps();
    await reserve(deps, { userId: USER, operationId: 'op_before_1', operation: 'SINGLE_JURY', amountCents: 400 });
    await settle(deps, { userId: USER, operationId: 'op_before_1', actualCents: 400 });
    await reserve(deps, { userId: USER, operationId: 'op_before_2', operation: 'SINGLE_JURY', amountCents: 400 });

    const plan = planOpeningEntry({
      userId: USER,
      legacyCounterCents: counterCents(),
      existingEntries: await deps.store.listEntries(USER),
      actor: 'backfill-test',
      now: new Date(),
    });
    if (plan.kind !== 'create') throw new Error('expected an opening entry');
    expect(plan.entry.amountCents).toBe(1200);
    await deps.store.appendEntry(plan.entry);

    const report = await reconcile(deps);
    expect(report.differenceCents).toBe(0);
    expect(report.isReconciled).toBe(true);
    expect(report.projection.buckets.legacy).toBe(400);
    expect(report.projection.reservedCents).toBe(400);

    const again = planOpeningEntry({
      userId: USER,
      legacyCounterCents: counterCents(),
      existingEntries: await deps.store.listEntries(USER),
      actor: 'backfill-test',
      now: new Date(),
    });
    expect(again.kind).toBe('skip');
  });

  it('is not reconciled without an opening entry', () => {
    const report = reconcileShadowProjection({ userId: USER, legacyCounterCents: 0, entries: [] });
    expect(report.hasOpeningEntry).toBe(false);
    expect(report.isReconciled).toBe(false);
  });

  it('derives stable entry ids shared with the backfill script', () => {
    // Pinned: scripts/rapido-ledger-backfill.mjs derives the same id with the same formula.
    expect(ledgerEntryId('user_1', 'opening', 'opening')).toBe('707d23067e8654b8163c8ac05945ac30ba1f');
    expect(ledgerEntryId('user_1', 'opening', 'opening')).toMatch(/^[0-9a-f]{36}$/);
    expect(ledgerEntryId('user_1', 'op_a', 'reserve')).not.toBe(ledgerEntryId('user_1', 'op_a', 'close'));
  });
});
