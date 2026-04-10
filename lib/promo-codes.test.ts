jest.mock('node-appwrite', () => ({
  ID: {
    unique: jest.fn(() => 'row_1'),
  },
  Query: {
    equal: jest.fn(() => 'equal'),
    limit: jest.fn(() => 'limit'),
  },
}));

jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_DATABASE_ID: 'draw_or_die',
  APPWRITE_TABLE_PROMO_CODES_ID: 'promo_codes',
  APPWRITE_TABLE_PROMO_REDEMPTIONS_ID: 'promo_redemptions',
  getAdminTables: jest.fn(),
  recordBillingEvent: jest.fn(),
  updateProfileById: jest.fn(),
  TIER_DEFAULTS: { PREMIUM: 200 },
}));

import { buildCheckoutAdjustment, normalizePromoCodeRow } from '@/lib/promo-codes';

describe('promo codes', () => {
  it('normalizes promo rows and keeps discount metadata', () => {
    const promo = normalizePromoCodeRow({
      $id: 'promo_1',
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
      $permissions: [],
      code: ' spring25 ',
      title: 'Spring 25',
      description: 'Seasonal discount',
      active: true,
      reward_kind: 'discount_percent',
      reward_value: 25,
      reward_currency: 'try',
      reward_interval: 'month',
      checkout_modes: 'premium_monthly,premium_yearly',
      target_scope: 'registered',
      max_total_uses: 100,
      max_uses_per_user: 1,
      used_count: 4,
      starts_at: '2026-04-01T00:00:00.000Z',
      ends_at: '2026-05-01T00:00:00.000Z',
      min_rapido_purchase: 0,
      metadata_json: '{"note":"launch"}',
    } as never);

    expect(promo.code).toBe('SPRING25');
    expect(promo.checkoutModes).toEqual(['premium_monthly', 'premium_yearly']);
    expect(promo.rewardKind).toBe('discount_percent');
    expect(promo.rewardValue).toBe(25);
    expect(promo.metadata).toEqual({ note: 'launch' });
  });

  it('builds discount adjustment metadata for checkout promos', () => {
    const promo = normalizePromoCodeRow({
      $id: 'promo_2',
      $createdAt: new Date().toISOString(),
      $updatedAt: new Date().toISOString(),
      $permissions: [],
      code: 'SAVE50',
      title: 'Half Off',
      active: true,
      reward_kind: 'discount_percent',
      reward_value: 50,
      used_count: 0,
    } as never);

    expect(buildCheckoutAdjustment(promo, 10_000)).toEqual({
      kind: 'discount_percent',
      percentOff: 50,
      promoCode: promo,
    });
  });
});
