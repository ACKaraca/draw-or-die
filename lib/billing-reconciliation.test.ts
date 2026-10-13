/**
 * @jest-environment node
 */
import {
  billingEventRowId,
  compareCountersToJournal,
  compareStripeToRecords,
  hasBlockingDrift,
  summarizeAiOperations,
} from '@/lib/billing-reconciliation.mjs';
import { ledgerRowIdForSource } from '@/lib/stripe-entitlements';

jest.mock('@/lib/appwrite/server', () => ({}));
jest.mock('@/lib/logger', () => ({ logServerError: jest.fn(), logServerInfo: jest.fn() }));

const NOW = new Date('2026-10-13T12:00:00.000Z');

function row(userId: string, operationId: string, kind: string, deltaCents: number, extra: Record<string, unknown> = {}) {
  return {
    user_id: userId,
    operation_id: operationId,
    kind,
    delta_cents: deltaCents,
    amount_cents: Math.abs(deltaCents),
    occurred_at: '2026-10-13T10:00:00.000Z',
    ...extra,
  };
}

const LEDGER = [
  row('u1', 'opening', 'opening', 1000),
  row('u1', 'op_a', 'reserve', -400, { operation: 'SINGLE_JURY', lease_expires_at: '2026-10-13T10:10:00.000Z' }),
  row('u1', 'op_a', 'settle', 0, { operation: 'SINGLE_JURY', amount_cents: 400 }),
  row('u1', 'op_b', 'reserve', -400, { operation: 'SINGLE_JURY', lease_expires_at: '2026-10-13T10:10:00.000Z' }),
  row('u1', 'op_b', 'void', 400, { operation: 'SINGLE_JURY' }),
  row('u2', 'opening', 'opening', 500),
  row('u2', 'op_c', 'reserve', -1000, { operation: 'MULTI_JURY', lease_expires_at: '2026-10-13T10:10:00.000Z' }),
];

describe('compareCountersToJournal', () => {
  it('flags counter drift above the threshold and open expired reservations, skips un-backfilled users', () => {
    const result = compareCountersToJournal(
      [
        { user_id: 'u1', rapido_pens: 6, rapido_fraction_cents: 0 },
        { user_id: 'u2', rapido_pens: 0, rapido_fraction_cents: 0 },
        { user_id: 'u3', rapido_pens: 15, rapido_fraction_cents: 0 },
      ],
      LEDGER,
      { now: NOW },
    );
    expect(result).toMatchObject({ usersCompared: 2, usersWithoutOpening: 1, openExpiredReservations: 1 });
    expect(result.drift).toEqual([
      { userId: 'u2', counterCents: 0, journaledCents: -500, differenceCents: 500, openExpired: 1 },
    ]);
  });

  it('tolerates drift within the threshold', () => {
    const result = compareCountersToJournal(
      [{ user_id: 'u1', rapido_pens: 6, rapido_fraction_cents: 5 }],
      LEDGER,
      { now: NOW, thresholdCents: 5 },
    );
    expect(result.drift).toEqual([]);
  });
});

describe('summarizeAiOperations', () => {
  it('counts reserve/settle/void per operation in the window and reports orphan closes', () => {
    const result = summarizeAiOperations(
      [...LEDGER, row('u1', 'op_orphan', 'void', 100, { operation: 'DEFENSE' })],
      { from: new Date('2026-10-13T00:00:00.000Z'), to: NOW },
    );
    expect(result.byOperation.SINGLE_JURY).toEqual({
      reserved: 2, settled: 1, voided: 1, open: 0, reservedCents: 800, chargedCents: 400, voidedCents: 400,
    });
    expect(result.byOperation.MULTI_JURY).toMatchObject({ reserved: 1, open: 1 });
    expect(result.anomalies).toEqual([{ code: 'CLOSE_WITHOUT_RESERVE', userId: 'u1', operationId: 'op_orphan' }]);
  });

  it('ignores reservations outside the window', () => {
    const result = summarizeAiOperations(LEDGER, { from: NOW, to: new Date(NOW.getTime() + 1) });
    expect(result.byOperation).toEqual({});
  });
});

describe('compareStripeToRecords', () => {
  const PACK = { id: 'cs_pack', object: 'checkout.session', mode: 'payment', payment_status: 'paid' };
  const SUB = { id: 'cs_sub', object: 'checkout.session', mode: 'subscription', payment_status: 'paid' };
  const BAD = { id: 'cs_bad', object: 'checkout.session', mode: 'payment', payment_status: 'paid' };
  const LOST = { id: 'cs_lost', object: 'checkout.session', mode: 'payment', payment_status: 'paid' };
  const UNPAID = { id: 'cs_unpaid', object: 'checkout.session', mode: 'payment', payment_status: 'unpaid' };
  const RENEWAL = { id: 'in_1', object: 'invoice', status: 'paid', billing_reason: 'subscription_cycle' };
  const FIRST = { id: 'in_0', object: 'invoice', status: 'paid', billing_reason: 'subscription_create' };

  it('mirrors the webhook billing_events row id', () => {
    expect(billingEventRowId('checkout:cs_1:rapido_pack')).toBe(ledgerRowIdForSource('checkout:cs_1:rapido_pack'));
  });

  it('reports paid objects without a billing event and Rapido grants without a ledger entry', () => {
    const events = new Map([
      [billingEventRowId('checkout:cs_pack:rapido_pack'), { rapido_delta: 10 }],
      [billingEventRowId('checkout:cs_sub:premium_allowance'), { rapido_delta: 185 }],
      [billingEventRowId('checkout:cs_bad:rejected'), { rapido_delta: 0 }],
      [billingEventRowId('invoice:in_1:premium_allowance'), { rapido_delta: 0 }],
    ]);
    const ledgerKeys = new Set(['checkout:cs_pack:rapido_pack']);

    const result = compareStripeToRecords([PACK, SUB, BAD, LOST, UNPAID, RENEWAL, FIRST], events, ledgerKeys);
    expect(result.checked).toBe(5);
    expect(result.missingBillingEvent).toEqual([
      { stripeId: 'cs_lost', expectedSourceKeys: ['checkout:cs_lost:rapido_pack', 'checkout:cs_lost:rejected'] },
    ]);
    expect(result.missingLedgerEntry).toEqual([
      { stripeId: 'cs_sub', sourceKey: 'checkout:cs_sub:premium_allowance', rapidoDelta: 185 },
    ]);
  });
});

describe('hasBlockingDrift', () => {
  const clean = {
    counters: { drift: [] },
    aiOperations: { anomalies: [] },
    stripe: { missingBillingEvent: [], missingLedgerEntry: [] },
  };

  it('is false only when every section reconciles', () => {
    expect(hasBlockingDrift(clean)).toBe(false);
    expect(hasBlockingDrift({ ...clean, stripe: null })).toBe(false);
    expect(hasBlockingDrift({ ...clean, counters: { drift: [{}] } })).toBe(true);
    expect(hasBlockingDrift({ ...clean, stripe: { missingBillingEvent: [], missingLedgerEntry: [{}] } })).toBe(true);
  });
});
