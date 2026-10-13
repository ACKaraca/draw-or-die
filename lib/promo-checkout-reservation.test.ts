import { FakeTables } from '@/__tests__/helpers/fake-appwrite-tables';
import {
  confirmCheckoutPromoReservation,
  normalizePromoCodeRow,
  releaseCheckoutPromoReservation,
  reserveCheckoutPromo,
} from '@/lib/promo-codes';
import type { PromoCodeRow } from '@/lib/appwrite/server';

let mockFake = new FakeTables();

jest.mock('node-appwrite', () => ({
  ID: { unique: () => 'unique()' },
  Query: jest.requireActual('@/__tests__/helpers/fake-appwrite-tables').fakeQuery,
}));

jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_DATABASE_ID: 'db',
  APPWRITE_TABLE_STRIPE_EVENTS_ID: 'stripe_events',
  APPWRITE_TABLE_PROMO_CODES_ID: 'promo_codes',
  APPWRITE_TABLE_PROMO_REDEMPTIONS_ID: 'promo_redemptions',
  getAdminTables: () => mockFake,
  recordBillingEvent: jest.fn(),
  updateProfileById: jest.fn(),
  markStripeEventProcessed: async (key: string) => {
    try {
      await mockFake.createRow({
        tableId: 'stripe_events',
        rowId: 'unique()',
        data: { event_id: key, processed_at: new Date().toISOString() },
      } as never);
      return false;
    } catch (error) {
      if ((error as { code?: number }).code === 409) return true;
      throw error;
    }
  },
}));

jest.mock('@/lib/logger', () => ({ logServerError: jest.fn() }));

function seedPromo(maxTotalUses: number | null, maxUsesPerUser: number | null) {
  const row = {
    $id: 'promo_1',
    code: 'HALF',
    title: 'Half off',
    active: true,
    reward_kind: 'discount_percent',
    reward_value: 50,
    target_scope: 'any',
    max_total_uses: maxTotalUses,
    max_uses_per_user: maxUsesPerUser,
    used_count: 0,
  };
  mockFake.seed('promo_codes', row);
  return normalizePromoCodeRow(row as unknown as PromoCodeRow);
}

function activeReservations() {
  return mockFake.rows('promo_redemptions').filter((row) => row.status !== 'released');
}

beforeEach(() => {
  mockFake = new FakeTables();
});

describe('internal checkout promo reservations', () => {
  it('lets only one of many parallel checkouts take the last global use', async () => {
    const promo = seedPromo(1, null);
    const results = await Promise.all(
      ['u1', 'u2', 'u3', 'u4'].map((userId) => reserveCheckoutPromo({ promo, userId, mode: 'premium_monthly' })),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(mockFake.table('promo_codes').get('promo_1')!.used_count).toBe(1);
    expect(activeReservations()).toHaveLength(1);
  });

  it('lets one user hold only one use of a once-per-user code, even in parallel', async () => {
    const promo = seedPromo(null, 1);
    const results = await Promise.all([1, 2, 3].map(() => reserveCheckoutPromo({ promo, userId: 'u1', mode: 'rapido_pack' })));

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(activeReservations()).toHaveLength(1);
  });

  it('returns the use on release (once) so the user can check out again', async () => {
    const promo = seedPromo(1, 1);
    const first = await reserveCheckoutPromo({ promo, userId: 'u1', mode: 'rapido_pack' });
    if (!first.ok) throw new Error('expected a reservation');

    expect(await reserveCheckoutPromo({ promo, userId: 'u1', mode: 'rapido_pack' })).toMatchObject({ ok: false });

    await Promise.all([
      releaseCheckoutPromoReservation(first.reservation.reservationId),
      releaseCheckoutPromoReservation(first.reservation.reservationId),
    ]);
    expect(mockFake.table('promo_codes').get('promo_1')!.used_count).toBe(0);

    const second = await reserveCheckoutPromo({ promo, userId: 'u1', mode: 'rapido_pack' });
    expect(second.ok).toBe(true);
  });

  it('keeps a redeemed reservation counted and ignores a later release', async () => {
    const promo = seedPromo(1, 1);
    const reserved = await reserveCheckoutPromo({ promo, userId: 'u1', mode: 'rapido_pack' });
    if (!reserved.ok) throw new Error('expected a reservation');

    await confirmCheckoutPromoReservation(reserved.reservation.reservationId, 'cs_1');
    expect(await confirmCheckoutPromoReservation(reserved.reservation.reservationId, 'cs_1')).toBe('already_redeemed');
    expect(await releaseCheckoutPromoReservation(reserved.reservation.reservationId)).toBe('noop');

    expect(mockFake.table('promo_codes').get('promo_1')!.used_count).toBe(1);
    expect(await reserveCheckoutPromo({ promo, userId: 'u2', mode: 'rapido_pack' })).toMatchObject({
      ok: false,
      code: 'PROMO_EXHAUSTED',
    });
  });

  it('rolls the counter and slot back when the reservation row cannot be written', async () => {
    const promo = seedPromo(1, 1);
    mockFake.failOnce('createRow', (params) => params.tableId === 'promo_redemptions');

    await expect(reserveCheckoutPromo({ promo, userId: 'u1', mode: 'rapido_pack' })).rejects.toThrow('injected');
    expect(mockFake.table('promo_codes').get('promo_1')!.used_count).toBe(0);
    expect((await reserveCheckoutPromo({ promo, userId: 'u1', mode: 'rapido_pack' })).ok).toBe(true);
  });
});
