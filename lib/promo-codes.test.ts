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

import type { AppwriteAuthUser, NormalizedUserProfile } from '@/lib/appwrite/server';
import {
  buildCheckoutAdjustment,
  isPromoInWindow,
  matchesCheckoutMode,
  matchesScope,
  normalizePromoCodeRow,
  type NormalizedPromoCode,
} from '@/lib/promo-codes';

function createPromo(overrides: Partial<NormalizedPromoCode> = {}): NormalizedPromoCode {
  return {
    id: 'promo_1',
    code: 'PROMO1',
    title: 'Promo',
    description: '',
    active: true,
    rewardKind: 'rapido',
    rewardValue: 1,
    rewardCurrency: null,
    rewardInterval: null,
    checkoutModes: [],
    targetScope: 'any',
    maxTotalUses: null,
    maxUsesPerUser: null,
    usedCount: 0,
    startsAt: null,
    endsAt: null,
    minRapidoPurchase: null,
    metadata: {},
    ...overrides,
  } as NormalizedPromoCode;
}

function createUser(email: string | null): AppwriteAuthUser {
  return {
    id: 'user_1',
    email,
    name: 'User',
  } as AppwriteAuthUser;
}

function createProfile(overrides: Partial<NormalizedUserProfile> = {}): NormalizedUserProfile {
  return {
    id: 'profile_1',
    email: 'user@example.com',
    is_premium: false,
    edu_verified: false,
    edu_email: null,
    ...overrides,
  } as NormalizedUserProfile;
}

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

  it('treats promo windows as inclusive at the boundaries', () => {
    const now = Date.parse('2026-04-11T12:00:00.000Z');
    jest.spyOn(Date, 'now').mockReturnValue(now);

    expect(
      isPromoInWindow(
        createPromo({
          startsAt: new Date(now).toISOString(),
          endsAt: new Date(now).toISOString(),
        }),
      ),
    ).toBe(true);

    expect(
      isPromoInWindow(
        createPromo({
          startsAt: new Date(now + 1).toISOString(),
        }),
      ),
    ).toBe(false);

    expect(
      isPromoInWindow(
        createPromo({
          endsAt: new Date(now - 1).toISOString(),
        }),
      ),
    ).toBe(false);
  });

  it('matches checkout modes by array containment', () => {
    const openPromo = createPromo();
    const scopedPromo = createPromo({ checkoutModes: ['premium_monthly'] });

    expect(matchesCheckoutMode(openPromo, 'rapido_pack')).toBe(true);
    expect(matchesCheckoutMode(scopedPromo, 'premium_monthly')).toBe(true);
    expect(matchesCheckoutMode(scopedPromo, 'premium_yearly')).toBe(false);
  });

  it('matches promo scopes across guest, registered, premium and edu edge cases', () => {
    const guestPromo = createPromo({ targetScope: 'guest' });
    const registeredPromo = createPromo({ targetScope: 'registered' });
    const premiumPromo = createPromo({ targetScope: 'premium' });
    const eduPromo = createPromo({ targetScope: 'edu' });
    const akdenizPromo = createPromo({ targetScope: 'akdeniz' });

    expect(matchesScope(guestPromo, createUser(null), createProfile())).toBe(true);
    expect(matchesScope(guestPromo, createUser('student@example.com'), createProfile())).toBe(false);

    expect(matchesScope(registeredPromo, createUser('student@example.com'), createProfile())).toBe(true);
    expect(matchesScope(registeredPromo, createUser(null), createProfile())).toBe(false);

    expect(matchesScope(premiumPromo, createUser('student@example.com'), createProfile({ is_premium: true }))).toBe(true);
    expect(matchesScope(premiumPromo, createUser('student@example.com'), createProfile({ is_premium: false }))).toBe(false);

    expect(matchesScope(eduPromo, createUser('student@example.com'), createProfile({ edu_verified: true }))).toBe(true);
    expect(matchesScope(eduPromo, createUser('student@example.com'), createProfile({ edu_verified: false }))).toBe(false);

    expect(
      matchesScope(
        akdenizPromo,
        createUser('student@example.com'),
        createProfile({ edu_verified: true, edu_email: 'student@akdeniz.edu.tr' }),
      ),
    ).toBe(true);
    expect(
      matchesScope(
        akdenizPromo,
        createUser('student@example.com'),
        createProfile({ edu_verified: true, edu_email: 'student@other.edu.tr' }),
      ),
    ).toBe(false);
    expect(
      matchesScope(
        akdenizPromo,
        createUser('student@example.com'),
        createProfile({ edu_verified: false, edu_email: 'student@akdeniz.edu.tr' }),
      ),
    ).toBe(false);
  });
});
