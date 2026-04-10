import type Stripe from 'stripe';
import { getAuthenticatedUserFromRequest, getOrCreateProfile } from '@/lib/appwrite/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { validatePromoForCheckout } from '@/lib/promo-codes';

const mockCreateSession = jest.fn();
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
}));

jest.mock('stripe', () => {
  const StripeMock: any = jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCreateSession,
      },
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
    mockedGetOrCreateProfile.mockResolvedValue({
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
    });
    mockedValidatePromoForCheckout.mockResolvedValue({
      valid: false,
      code: 'PROMO_NOT_FOUND',
      error: 'Promo kodu bulunamadi.',
    });
    mockCreateSession.mockResolvedValue({ url: 'https://stripe.test/session' } as Stripe.Checkout.Session);
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

  it('creates rapido checkout sessions with a server-enforced minimum quantity', async () => {
    mockedGetAuthenticatedUserFromRequest.mockResolvedValueOnce({
      id: 'user-rapido',
      email: 'user@example.com',
      name: 'Rapido User',
    });
    const POST = await loadRoute();

    const response = await POST(
      createRequest(
        { mode: 'rapido_pack', quantity: 1 },
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
});
