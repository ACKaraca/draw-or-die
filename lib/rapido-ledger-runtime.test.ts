/**
 * @jest-environment node
 */
import { createAppwriteLedgerStore, reconcileShadowProjection } from '@/lib/rapido-ledger';
import { creditRapidoThroughLedger, resetRapidoLedgerAvailabilityForTests } from '@/lib/rapido-ledger-runtime';
import { applyEntitlementEffect, type EntitlementEffect } from '@/lib/stripe-entitlements';
import { FakeTables } from '@/lib/test-utils/fake-appwrite-tables';

let mockFakeTables = new FakeTables();

jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_DATABASE_ID: 'db',
  APPWRITE_TABLE_PROFILES_ID: 'profiles',
  APPWRITE_TABLE_BILLING_EVENTS_ID: 'billing_events',
  APPWRITE_TABLE_RAPIDO_LEDGER_ID: 'rapido_ledger_entries',
  getAdminTables: () => mockFakeTables,
  updateProfileById: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logServerError: jest.fn(),
  logServerInfo: jest.fn(),
}));

const USER = 'user_1';
const ROW = 'row_1';

function counterCents(): number {
  const row = mockFakeTables.data.get('profiles')?.get(ROW);
  return Number(row?.rapido_pens) * 100 + Number(row?.rapido_fraction_cents);
}

async function reconcile() {
  const store = createAppwriteLedgerStore();
  return reconcileShadowProjection({
    userId: USER,
    legacyCounterCents: counterCents(),
    entries: await store.listEntries(USER),
  });
}

function stripeEffect(sourceKey: string, eventType: string, rapidoDelta: number): EntitlementEffect {
  return {
    kind: 'ledger',
    sourceKey,
    userId: USER,
    profileRowId: ROW,
    knownBalance: Math.trunc(counterCents() / 100),
    rapidoDelta,
    entry: { eventType, amountCents: 0, currency: 'try' },
  };
}

beforeEach(() => {
  mockFakeTables = new FakeTables();
  mockFakeTables.seed('profiles', { $id: ROW, rapido_pens: 0, rapido_fraction_cents: 0 });
  // Journal starts at zero so the projection must explain the counter from the opening onward.
  mockFakeTables.seed('rapido_ledger_entries', {
    $id: 'opening',
    user_id: USER,
    operation_id: 'opening',
    kind: 'opening',
    bucket: 'legacy',
    delta_cents: 0,
    amount_cents: 0,
    reason: 'test',
    actor: 'test',
    occurred_at: '2026-01-01T00:00:00.000Z',
  });
  resetRapidoLedgerAvailabilityForTests();
  delete process.env.RAPIDO_LEDGER_MODE;
});

describe('creditRapidoThroughLedger', () => {
  const input = {
    userId: USER,
    profileRowId: ROW,
    sourceId: 'reward:peer_review:u1:review_1',
    bucket: 'promotional' as const,
    amountCents: 250,
    knownBalanceCents: 0,
    reason: 'reward',
  };

  it('journals a promotional grant, credits the counter once and reconciles', async () => {
    expect(await creditRapidoThroughLedger(input)).toBe(250);
    expect(await creditRapidoThroughLedger({ ...input, knownBalanceCents: 250 })).toBe(250);

    expect(counterCents()).toBe(250);
    const report = await reconcile();
    expect(report.isReconciled).toBe(true);
    expect(report.projection.buckets.promotional).toBe(250);
  });

  it('returns null (legacy fallback) when switched off or the journal table is missing', async () => {
    process.env.RAPIDO_LEDGER_MODE = 'off';
    expect(await creditRapidoThroughLedger(input)).toBeNull();

    delete process.env.RAPIDO_LEDGER_MODE;
    mockFakeTables.missingTables.add('rapido_ledger_entries');
    expect(await creditRapidoThroughLedger(input)).toBeNull();
    expect(counterCents()).toBe(0);
  });
});

describe('applyEntitlementEffect ledger journaling', () => {
  it('journals pack purchases and allowance top-ups exactly once and reconciles with the counter', async () => {
    const pack = stripeEffect('checkout:cs_1:rapido_pack', 'rapido_pack', 10);
    expect((await applyEntitlementEffect(pack)).applied).toBe(true);
    expect((await applyEntitlementEffect(pack)).applied).toBe(false);
    await applyEntitlementEffect(stripeEffect('invoice:in_1:premium_allowance', 'premium_renewal', 5));

    expect(counterCents()).toBe(1500);
    const report = await reconcile();
    expect(report.isReconciled).toBe(true);
    expect(report.projection.buckets).toMatchObject({ purchased: 1000, allowance: 500 });
  });

  it('journals a revocation as a purchased-bucket correction after the debit', async () => {
    await applyEntitlementEffect(stripeEffect('checkout:cs_1:rapido_pack', 'rapido_pack', 10));
    await applyEntitlementEffect(stripeEffect('refund:re_1', 'rapido_pack_refunded', -4));

    expect(counterCents()).toBe(600);
    const report = await reconcile();
    expect(report.isReconciled).toBe(true);
    expect(report.projection.buckets.purchased).toBe(600);
  });

  it('still applies the effect while the journal table is not provisioned', async () => {
    mockFakeTables.missingTables.add('rapido_ledger_entries');
    const result = await applyEntitlementEffect(stripeEffect('checkout:cs_2:rapido_pack', 'rapido_pack', 3));
    expect(result).toMatchObject({ applied: true, rapidoDelta: 3 });
    expect(counterCents()).toBe(300);
  });
});
