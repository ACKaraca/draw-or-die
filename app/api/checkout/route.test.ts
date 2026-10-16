import type Stripe from 'stripe';
import { getAuthenticatedUserFromRequest, getOrCreateProfile } from '@/lib/appwrite/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { releaseCheckoutPromoReservation, reserveCheckoutPromo, validatePromoForCheckout } from '@/lib/promo-codes';

const mockCreateSession = jest.fn();
const mockListPromotionCodes = jest.fn();
const mockRetrievePromotionCode = jest.fn();
const mockListSubscriptions = jest.fn();
const mockEnsureCoreAppwriteResources = jest.fn();
const mockEnsureCommerceAppwriteResources = jest.fn();

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('@/lib/appwrite/server', () => ({
  getAuthenticatedUserFromRequest: jest.fn(),
  getOrCreateProfile: jest.fn(),
  getVerifiedEmail: (user: { email: string | null; emailVerified?: boolean }) =>
    (user.emailVerified === true && user.email ? user.email : null),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  RATE_LIMITS: {
    CHECKOUT: { maxRequests: 5, windowMs: 60_000 },
  },
}));

jest.mock('@/lib/appwrite/resource-bootstrap', () => ({
  ensureCoreAppwriteResources: (...args: unknown[]) => mockEnsureCoreAppwriteResources(...args),
  ensureCommerceAppwriteResources: (...args: unknown[]) => mockEnsureCommerceAppwriteResources(...args),
}));

jest.mock('@/lib/promo-codes', () => ({
  validatePromoForCheckout: jest.fn(),
  reserveCheckoutPromo: jest.fn(),
  releaseCheckoutPromoReservation: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({ logServerError: jest.fn() }));

jest.mock('stripe', () => {
  const StripeMock: any = jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCreateSession,
      },
    },
    promotionCodes: {
      list: mockListPromotionCodes,
      retrieve: mockRetrievePromotionCode,
    },
    subscriptions: {
      list: mockListSubscriptions,
    },
  }));

  StripeMock.errors = {
    StripeInvalidRequestError: class StripeInvalidRequestError extends Error {},
  };

  return {
    __esModule: true,
    default: StripeMock,
  };
});

const mockedGetAuthenticatedUserFromRequest = jest.mocked(getAuthenticatedUserFromRequest);
const mockedGetOrCreateProfile = jest.mocked(getOrCreateProfile);
const mockedCheckRateLimit = jest.mocked(checkRateLimit);
const mockedValidatePromoForCheckout = jest.mocked(validatePromoForCheckout);
const mockedReserveCheckoutPromo = jest.mocked(reserveCheckoutPromo);
const mockedReleaseCheckoutPromoReservation = jest.mocked(releaseCheckoutPromoReservation);

const BASE_PROFILE = {
    id: 'user-1',
    email: 'user@example.com',
    is_premium: false,
    rapido_pens: 50,
    rapido_fraction_cents: 0,
    progression_score: 0,
    wall_of_death_count: 0,
    earned_badges: [],
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: null,
    subscription_current_period_start: null,
    subscription_current_period_end: null,
    subscription_cancel_at_period_end: false,
    premium_started_at: null,
    premium_price_cents: null,
    premium_currency: null,
    premium_interval: null,
    premium_promo_code: null,
    edu_verified: false,
    edu_email: null,
    edu_verification_code: null,
    edu_verification_email: null,
    edu_verification_expires: null,
    referral_code: null,
    referred_by: null,
    referral_rewarded_at: null,
  } as never as Awaited<ReturnType<typeof getOrCreateProfile>>;

const INTERNAL_PROMO = {
  valid: true,
  source: 'internal',
  promotionCodeId: 'promo-row-1',
  promoCode: 'STUDIO20',
  promo: {
    id: 'promo-row-1',
    code: 'STUDIO20',
    rewardKind: 'discount_percent',
    rewardValue: 20,
  },
  coupon: null,
  summary: '',
} as never;

async function loadRoute() {
  const mod = await import('@/app/api/checkout/route');
  return mod.POST;
}

function createRequest(body: unknown, headers?: Record<string, string>) {
  return {
    headers: {
      get: (key: string) => headers?.[key] ?? headers?.[key.toLowerCase()] ?? null,
    },
    json: jest.fn().mockResolvedValue(body),
  };
}

describe('POST /api/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_checkout_secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.drawor-die.com';
    mockEnsureCoreAppwriteResources.mockResolvedValue(undefined);
    mockEnsureCommerceAppwriteResources.mockResolvedValue(undefined);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: Date.now() + 60_000,
    });
    mockedGetAuthenticatedUserFromRequest.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
    });
    mockedGetOrCreateProfile.mockResolvedValue(BASE_PROFILE);
    mockedValidatePromoForCheckout.mockResolvedValue({
      valid: false,
      code: 'PROMO_NOT_FOUND',
      error: 'Promo kodu bulunamadi.',
    });
    mockCreateSession.mockResolvedValue({ url: 'https://stripe.test/session' } as Stripe.Checkout.Session);
    mockListPromotionCodes.mockResolvedValue({ data: [] });
    mockRetrievePromotionCode.mockRejectedValue(new Error('No such promotion code'));
    mockListSubscriptions.mockReset().mockResolvedValue({ data: [] });
    mockedReserveCheckoutPromo.mockResolvedValue({
      ok: true,
      reservation: { reservationId: 'reservation-1', promoId: 'promo-row-1' },
    });
    mockedReleaseCheckoutPromoReservation.mockResolvedValue('released');
  });

  it('returns 503 when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const POST = await loadRoute();

    const response = await POST(
      createRequest({ mode: 'premium_monthly' }) as never
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: expect.stringContaining('Stripe') })
    );
  });

  it('returns 401 when the user is not authenticated', async () => {
    mockedGetAuthenticatedUserFromRequest.mockResolvedValueOnce(null);
    const POST = await loadRoute();

    const response = await POST(
      createRequest({ mode: 'premium_monthly' }) as never
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: expect.stringContaining('Giriş') })
    );
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });
    const POST = await loadRoute();

    const response = await POST(
      createRequest({ mode: 'premium_monthly' }) as never
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: expect.stringContaining('fazla') })
    );
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid checkout mode', async () => {
    const POST = await loadRoute();

    const response = await POST(
      createRequest({ mode: 'invalid_mode' }) as never
    );

    expect(response.status).toBe(400);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it.each([
    ['below the minimum', 1],
    ['above the maximum', 1001],
    ['fractional', 5.5],
    ['a numeric string', '10'],
    ['negative', -5],
  ])('rejects a rapido quantity that is %s', async (_label, quantity) => {
    const POST = await loadRoute();

    const response = await POST(
      createRequest({ mode: 'rapido_pack', quantity }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ code: 'INVALID_RAPIDO_QUANTITY', error: expect.stringContaining('Rapido') })
    );
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('returns the quantity error in English when requested', async () => {
    const POST = await loadRoute();

    const response = await POST(
      createRequest({ mode: 'rapido_pack', quantity: 2 }, { 'accept-language': 'en-US,en;q=0.9' }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: 'Rapido quantity must be a whole number between 5 and 1000.' })
    );
  });

  it('accepts an in-range rapido quantity', async () => {
    const POST = await loadRoute();

    const response = await POST(
      createRequest({ mode: 'rapido_pack', quantity: 1000 }) as never
    );

    expect(response.status).toBe(200);
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_1TJfaeR9Q18j8gkWLFU14ZxI', quantity: 1000 }],
        metadata: expect.objectContaining({ rapido_quantity: '1000' }),
      })
    );
  });

  it('applies an internal promo without looking the code up in Stripe', async () => {
    mockedValidatePromoForCheckout.mockResolvedValueOnce({
      valid: true,
      source: 'internal',
      promotionCodeId: 'promo-row-1',
      promoCode: 'STUDIO20',
      promo: {
        id: 'promo-row-1',
        code: 'STUDIO20',
        rewardKind: 'discount_percent',
        rewardValue: 20,
      },
      coupon: null,
      summary: '',
    } as never);
    const POST = await loadRoute();

    const response = await POST(
      createRequest({ mode: 'rapido_pack', quantity: 10, promoCode: 'STUDIO20' }) as never
    );

    expect(response.status).toBe(200);
    expect(mockListPromotionCodes).not.toHaveBeenCalled();
    expect(mockRetrievePromotionCode).not.toHaveBeenCalled();
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        allow_promotion_codes: false,
        line_items: [expect.objectContaining({
          quantity: 10,
          price_data: expect.objectContaining({ unit_amount: 63 }),
        })],
        metadata: expect.objectContaining({
          promo_code: 'STUDIO20',
          promotion_code_id: 'promo-row-1',
          promo_source: 'internal',
          promo_reservation_id: 'reservation-1',
          expected_unit_amount: '63',
        }),
      })
    );
    expect(mockCreateSession.mock.calls[0][0]).not.toHaveProperty('discounts');
    expect(mockCreateSession.mock.calls[0][0]).toHaveProperty('expires_at');
    expect(mockedReserveCheckoutPromo).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', mode: 'rapido_pack' }),
    );
  });

  it('never applies a Stripe promotion code on top of an internal promo', async () => {
    mockedValidatePromoForCheckout.mockResolvedValueOnce(INTERNAL_PROMO);
    const POST = await loadRoute();

    await POST(
      createRequest({ mode: 'rapido_pack', quantity: 10, promoCode: 'STUDIO20', promotionCodeId: 'promo_stripe_1' }) as never
    );

    expect(mockRetrievePromotionCode).not.toHaveBeenCalled();
    const args = mockCreateSession.mock.calls[0][0];
    expect(args).not.toHaveProperty('discounts');
    expect(args.allow_promotion_codes).toBe(false);
  });

  it('rejects an internal promo whose quota is already used up', async () => {
    mockedValidatePromoForCheckout.mockResolvedValueOnce(INTERNAL_PROMO);
    mockedReserveCheckoutPromo.mockResolvedValueOnce({ ok: false, code: 'PROMO_EXHAUSTED', error: 'doldu' });
    const POST = await loadRoute();

    const response = await POST(
      createRequest({ mode: 'rapido_pack', quantity: 10, promoCode: 'STUDIO20' }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ code: 'PROMO_EXHAUSTED' }));
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('gives the promo reservation back when the Stripe session cannot be created', async () => {
    mockedValidatePromoForCheckout.mockResolvedValueOnce(INTERNAL_PROMO);
    mockCreateSession.mockRejectedValueOnce(new Error('stripe down'));
    const POST = await loadRoute();

    const response = await POST(
      createRequest({ mode: 'rapido_pack', quantity: 10, promoCode: 'STUDIO20' }) as never
    );

    expect(response.status).toBe(500);
    expect(mockedReleaseCheckoutPromoReservation).toHaveBeenCalledWith('reservation-1');
  });

  it('reuses the existing Stripe customer instead of creating a new one', async () => {
    mockedGetOrCreateProfile.mockResolvedValueOnce({
      ...BASE_PROFILE,
      stripe_customer_id: 'cus_existing',
    });
    const POST = await loadRoute();

    await POST(createRequest({ mode: 'rapido_pack', quantity: 5 }) as never);

    const args = mockCreateSession.mock.calls[0][0];
    expect(args.customer).toBe('cus_existing');
    expect(args).not.toHaveProperty('customer_email');
  });

  it.each([
    ['the profile already has an active subscription', { is_premium: true, stripe_subscription_id: 'sub_1', subscription_status: 'active' }, []],
    ['Stripe reports an active subscription for the customer', { stripe_customer_id: 'cus_existing' }, [{ status: 'active' }]],
    ['Stripe reports a past_due subscription for the customer', { stripe_customer_id: 'cus_existing' }, [{ status: 'past_due' }]],
  ])('blocks a second subscription when %s', async (_label, profilePatch, subscriptions) => {
    mockedGetOrCreateProfile.mockResolvedValueOnce({
      ...BASE_PROFILE,
      ...profilePatch,
    });
    mockListSubscriptions.mockResolvedValueOnce({ data: subscriptions });
    const POST = await loadRoute();

    const response = await POST(createRequest({ mode: 'premium_monthly' }) as never);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ code: 'SUBSCRIPTION_ALREADY_ACTIVE' }));
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('allows a new subscription when previous ones are canceled', async () => {
    mockedGetOrCreateProfile.mockResolvedValueOnce({
      ...BASE_PROFILE,
      stripe_customer_id: 'cus_existing',
    });
    mockListSubscriptions.mockResolvedValueOnce({ data: [{ status: 'canceled' }, { status: 'incomplete_expired' }] });
    const POST = await loadRoute();

    const response = await POST(createRequest({ mode: 'premium_monthly' }) as never);

    expect(response.status).toBe(200);
    expect(mockListSubscriptions).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_existing', status: 'all' }));
  });

  it('builds a success URL that only signals the redirect (entitlements come from the webhook)', async () => {
    const POST = await loadRoute();
    await POST(createRequest({ mode: 'premium_monthly' }) as never);

    const args = mockCreateSession.mock.calls[0][0];
    expect(args.success_url).toBe('https://app.drawor-die.com?checkout=success&session_id={CHECKOUT_SESSION_ID}');
  });

  it('still rejects an unknown promo code that is not internal', async () => {
    const POST = await loadRoute();

    const response = await POST(
      createRequest({ mode: 'premium_monthly', promoCode: 'NOPE' }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ code: 'INVALID_PROMO_CODE' })
    );
    expect(mockListPromotionCodes).toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('defaults to the minimum rapido quantity when none is sent', async () => {
    mockedGetAuthenticatedUserFromRequest.mockResolvedValueOnce({
      id: 'user-rapido',
      email: 'user@example.com',
      name: 'Rapido User',
    });
    const POST = await loadRoute();

    const response = await POST(
      createRequest(
        { mode: 'rapido_pack' },
        { origin: 'https://drawor-die.com', 'content-type': 'application/json' }
      ) as never
    );

    expect(response.status).toBe(200);
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: 'user@example.com',
        client_reference_id: 'user-rapido',
        mode: 'payment',
        line_items: [{ price: 'price_1TJfaeR9Q18j8gkWLFU14ZxI', quantity: 5 }],
        success_url: 'https://drawor-die.com?checkout=success&session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://drawor-die.com?checkout=cancelled',
        metadata: expect.objectContaining({
          user_id: 'user-rapido',
          checkout_mode: 'rapido_pack',
          rapido_quantity: '5',
          pricing_tier: 'GLOBAL',
        }),
      })
    );
    await expect(response.json()).resolves.toEqual({ url: 'https://stripe.test/session' });
  });

  it('uses the student tier for edu.tr users on subscriptions', async () => {
    mockedGetAuthenticatedUserFromRequest.mockResolvedValueOnce({
      id: 'user-student',
      email: 'student@itu.edu.tr',
      name: 'Student User',
      emailVerified: true,
    });
    const POST = await loadRoute();

    await POST(
      createRequest({ mode: 'premium_yearly' }) as never
    );

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: 'student@itu.edu.tr',
        client_reference_id: 'user-student',
        mode: 'subscription',
        line_items: [{ price: 'price_1TJfafR9Q18j8gkWATTSoYr5', quantity: 1 }],
        success_url: 'https://app.drawor-die.com?checkout=success&session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://app.drawor-die.com?checkout=cancelled',
      })
    );
  });

  it('does not grant student pricing for an unverified edu.tr signup email', async () => {
    mockedGetAuthenticatedUserFromRequest.mockResolvedValueOnce({
      id: 'user-unverified',
      email: 'someone@itu.edu.tr',
      name: 'Unverified',
      emailVerified: false,
    });
    const POST = await loadRoute();

    await POST(
      createRequest({ mode: 'premium_yearly' }) as never
    );

    const sessionArgs = mockCreateSession.mock.calls[0][0] as { line_items: Array<{ price: string }> };
    expect(sessionArgs.line_items[0].price).not.toBe('price_1TJfafR9Q18j8gkWATTSoYr5');
  });
});
