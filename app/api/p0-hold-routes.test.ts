import { resetHoldCache } from '@/lib/p0-holds';

const mockGetFeatureFlag = jest.fn();
const mockGetUser = jest.fn();
const mockGetOrCreateProfile = jest.fn();
const mockEnsureCore = jest.fn();
const mockEnsureCommerce = jest.fn();
const mockApplyReferralReward = jest.fn();
const mockRedeemPromoCode = jest.fn();

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('node-appwrite', () => ({
  ID: { unique: () => 'id' },
  Query: {},
  Messaging: jest.fn(),
  MessagingProviderType: {},
  Users: jest.fn(),
}));

jest.mock('@/lib/appwrite/server', () => ({
  getFeatureFlag: (...args: unknown[]) => mockGetFeatureFlag(...args),
  getAuthenticatedUserFromRequest: (...args: unknown[]) => mockGetUser(...args),
  getOrCreateProfile: (...args: unknown[]) => mockGetOrCreateProfile(...args),
}));

jest.mock('@/lib/appwrite/resource-bootstrap', () => ({
  ensureCoreAppwriteResources: (...args: unknown[]) => mockEnsureCore(...args),
  ensureCommerceAppwriteResources: (...args: unknown[]) => mockEnsureCommerce(...args),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 1, resetAt: 0 }),
  RATE_LIMITS: { CHECKOUT: { maxRequests: 5, windowMs: 60_000 } },
}));

jest.mock('@/lib/referral', () => ({
  applyReferralReward: (...args: unknown[]) => mockApplyReferralReward(...args),
}));

jest.mock('@/lib/promo-codes', () => ({
  redeemPromoCode: (...args: unknown[]) => mockRedeemPromoCode(...args),
}));

type HeldRoute = {
  name: string;
  hold: string;
  call: () => Promise<{ status: number; json: () => Promise<unknown> }>;
};

function createRequest(body: unknown = {}, url = 'https://drawordie.app/api/x') {
  return {
    headers: { get: () => null },
    json: jest.fn().mockResolvedValue(body),
    url,
    nextUrl: new URL(url),
  } as never;
}

const HELD_ROUTES: HeldRoute[] = [
  {
    name: 'GET /api/gallery (public list)',
    hold: 'gallery_public',
    call: async () => (await import('@/app/api/gallery/route')).GET(createRequest()),
  },
  {
    name: 'POST /api/gallery',
    hold: 'gallery_public',
    call: async () => (await import('@/app/api/gallery/route')).POST(createRequest({ title: 'x' })),
  },
  {
    name: 'PATCH /api/gallery RESHARE',
    hold: 'gallery_public',
    call: async () =>
      (await import('@/app/api/gallery/route')).PATCH(createRequest({ submissionId: 's1', action: 'RESHARE' })),
  },
  {
    name: 'GET /api/peer-review',
    hold: 'gallery_public',
    call: async () => (await import('@/app/api/peer-review/route')).GET(createRequest()),
  },
  {
    name: 'POST /api/peer-review/open',
    hold: 'gallery_public',
    call: async () => (await import('@/app/api/peer-review/open/route')).POST(createRequest({ submissionId: 's1' })),
  },
  {
    name: 'POST /api/verify-edu',
    hold: 'edu_verification',
    call: async () => (await import('@/app/api/verify-edu/route')).POST(createRequest({ email: 'a@b.edu.tr' })),
  },
  {
    name: 'PUT /api/verify-edu',
    hold: 'edu_verification',
    call: async () => (await import('@/app/api/verify-edu/route')).PUT(createRequest({ code: '123456' })),
  },
  {
    name: 'POST /api/referral/apply',
    hold: 'rewards',
    call: async () => (await import('@/app/api/referral/apply/route')).POST(createRequest({ code: 'REF' })),
  },
  {
    name: 'POST /api/promos/redeem',
    hold: 'rewards',
    call: async () => (await import('@/app/api/promos/redeem/route')).POST(createRequest({ code: 'PROMO' })),
  },
];

describe('P0 containment holds on API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetHoldCache();
    // No release record: every hold is active (fail-closed default).
    mockGetFeatureFlag.mockResolvedValue(null);
    mockGetUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com', emailVerified: true });
  });

  it.each(HELD_ROUTES)('$name returns 503 CAPABILITY_ON_HOLD ($hold) without side effects', async (route) => {
    const response = await route.call();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ code: 'CAPABILITY_ON_HOLD', hold: route.hold }),
    );
    expect(mockApplyReferralReward).not.toHaveBeenCalled();
    expect(mockRedeemPromoCode).not.toHaveBeenCalled();
    expect(mockEnsureCommerce).not.toHaveBeenCalled();
  });
});
