import {
  AI_MENTOR_BILLING,
  PREMIUM_FEATURES,
  RAPIDO_COSTS,
  STRIPE_PRICES,
  TIER_DEFAULTS,
  isAkdenizStudentEmail,
  isEduTrEmail,
  isPremiumOnly,
  resolveStripeTierByEmail,
  resolveStripeTierForUser,
} from '@/lib/pricing';

describe('pricing', () => {
  it('keeps rapido costs aligned with expected business rules', () => {
    expect(RAPIDO_COSTS).toMatchObject({
      SINGLE_JURY: 4,
      REVISION_SAME: 1,
      REVISION_DIFFERENT: 2,
      MULTI_JURY: 10,
      MULTI_JURY_REVISION: 2,
      AUTO_CONCEPT: 5,
      MATERIAL_BOARD: 3,
      DEFENSE: 4,
      AI_MENTOR: 1,
      PREMIUM_RESCUE: 6,
    });
    expect(RAPIDO_COSTS.SINGLE_JURY).toBe(4);
    expect(RAPIDO_COSTS.REVISION_SAME).toBe(1);
    expect(RAPIDO_COSTS.MULTI_JURY).toBe(10);
    expect(RAPIDO_COSTS.PREMIUM_RESCUE).toBe(6);
  });

  it('keeps tier defaults in ascending order of access level', () => {
    expect(TIER_DEFAULTS).toEqual({
      GUEST: 4,
      ANONYMOUS: 4,
      REGISTERED: 15,
      PREMIUM: 200,
    });
    expect(TIER_DEFAULTS.GUEST).toBeLessThanOrEqual(TIER_DEFAULTS.ANONYMOUS);
    expect(TIER_DEFAULTS.ANONYMOUS).toBeLessThan(TIER_DEFAULTS.REGISTERED);
    expect(TIER_DEFAULTS.REGISTERED).toBeLessThan(TIER_DEFAULTS.PREMIUM);
  });

  it('keeps hidden mentor billing ratio aligned with product rules', () => {
    expect(AI_MENTOR_BILLING).toEqual({
      TOKENS_PER_UNIT: 1000,
      RAPIDO_PER_UNIT: 3,
      MIN_CHARGE: 0.01,
    });
  });

  it('marks premium operations as premium only', () => {
    for (const feature of PREMIUM_FEATURES) {
      expect(isPremiumOnly(feature)).toBe(true);
    }
  });

  it('does not mark base operations as premium only', () => {
    expect(isPremiumOnly('SINGLE_JURY')).toBe(false);
    expect(isPremiumOnly('REVISION_SAME')).toBe(false);
    expect(isPremiumOnly('REVISION_DIFFERENT')).toBe(false);
    expect(isPremiumOnly('AUTO_CONCEPT')).toBe(false);
    expect(isPremiumOnly('PREMIUM_RESCUE')).toBe(false);
  });

  it('accepts edu.tr addresses case-insensitively', () => {
    expect(isEduTrEmail('student@itu.edu.tr')).toBe(true);
    expect(isEduTrEmail('Student@METU.EDU.TR')).toBe(true);
  });

  it('rejects non edu.tr addresses', () => {
    expect(isEduTrEmail('student@example.com')).toBe(false);
    expect(isEduTrEmail('student@university.edu')).toBe(false);
    expect(isEduTrEmail('student@edu.tr.example.com')).toBe(false);
  });

  it('detects akdeniz edu domain and subdomains', () => {
    expect(isAkdenizStudentEmail('demo@ogr.akdeniz.edu.tr')).toBe(true);
    expect(isAkdenizStudentEmail('demo@akdeniz.edu.tr')).toBe(true);
    expect(isAkdenizStudentEmail('demo@mail.akdeniz.edu.tr')).toBe(true);
    expect(isAkdenizStudentEmail('demo@akdeniz.edu.tr.example.com')).toBe(false);
  });

  it('resolves stripe tier from email domain', () => {
    expect(resolveStripeTierByEmail('demo@ogr.akdeniz.edu.tr')).toBe('AKDENIZ_STUDENT');
    expect(resolveStripeTierByEmail('demo@metu.edu.tr')).toBe('TR_STUDENT');
    expect(resolveStripeTierByEmail('demo@example.com')).toBe('GLOBAL');
  });

  it('resolves stripe tier from verified secondary edu email', () => {
    expect(resolveStripeTierForUser({
      primaryEmail: 'demo@example.com',
      eduVerified: true,
      eduEmail: 'demo@metu.edu.tr',
    })).toBe('TR_STUDENT');

    expect(resolveStripeTierForUser({
      primaryEmail: 'demo@example.com',
      eduVerified: true,
      eduEmail: 'demo@ogr.akdeniz.edu.tr',
    })).toBe('AKDENIZ_STUDENT');

    expect(resolveStripeTierForUser({
      primaryEmail: 'demo@example.com',
      eduVerified: false,
      eduEmail: 'demo@metu.edu.tr',
    })).toBe('GLOBAL');
  });

  it('keeps Turkish student pricing in TRY and global pricing in USD', () => {
    expect(STRIPE_PRICES.TR_STUDENT.CURRENCY).toBe('try');
    expect(STRIPE_PRICES.GLOBAL.CURRENCY).toBe('usd');
    expect(STRIPE_PRICES.AKDENIZ_STUDENT.CURRENCY).toBe('try');
    expect(STRIPE_PRICES.AKDENIZ_STUDENT.MONTHLY).toBe(14900);
    expect(STRIPE_PRICES.TR_STUDENT.MONTHLY).toBe(29900);
    expect(STRIPE_PRICES.TR_STUDENT.YEARLY).toBe(249900);
    expect(STRIPE_PRICES.TR_STUDENT.RAPIDO_UNIT).toBe(395);
    expect(STRIPE_PRICES.GLOBAL.MONTHLY).toBe(1500);
    expect(STRIPE_PRICES.GLOBAL.YEARLY).toBe(12900);
    expect(STRIPE_PRICES.GLOBAL.RAPIDO_UNIT).toBe(79);
  });

  it('enforces a minimum rapido purchase size', () => {
    expect(STRIPE_PRICES.MIN_RAPIDO_PURCHASE).toBe(5);
  });

  it('keeps Stripe price ids and product ids populated', () => {
    expect(STRIPE_PRICES.AKDENIZ_STUDENT.PRICE_IDS.MONTHLY).toMatch(/^price_/);
    expect(STRIPE_PRICES.AKDENIZ_STUDENT.PRICE_IDS.YEARLY).toMatch(/^price_/);
    expect(STRIPE_PRICES.AKDENIZ_STUDENT.PRICE_IDS.RAPIDO).toMatch(/^price_/);
    expect(STRIPE_PRICES.TR_STUDENT.PRICE_IDS.MONTHLY).toMatch(/^price_/);
    expect(STRIPE_PRICES.TR_STUDENT.PRODUCT_ID).toMatch(/^prod_/);
    expect(STRIPE_PRICES.GLOBAL.PRICE_IDS.RAPIDO).toMatch(/^price_/);
    expect(STRIPE_PRICES.RAPIDO_PRODUCT_ID).toMatch(/^prod_/);
  });
});
