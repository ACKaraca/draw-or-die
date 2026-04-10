const mockConstructEvent = jest.fn();
const mockRetrieveSubscription = jest.fn();
const mockEnsureCoreAppwriteResources = jest.fn();
const mockMarkStripeEventProcessed = jest.fn();
const mockGetOrCreateProfile = jest.fn();
const mockUpdateProfileById = jest.fn();
const mockFindProfileBySubscriptionId = jest.fn();
const mockCreateRow = jest.fn();

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('stripe', () => {
  const StripeMock: any = jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    subscriptions: {
      retrieve: mockRetrieveSubscription,
    },
  }));

  return {
    __esModule: true,
    default: StripeMock,
  };
});

jest.mock('@/lib/appwrite/resource-bootstrap', () => ({
  ensureCoreAppwriteResources: (...args: unknown[]) => mockEnsureCoreAppwriteResources(...args),
}));

jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_DATABASE_ID: 'draw_or_die',
  APPWRITE_TABLE_BILLING_EVENTS_ID: 'billing_events',
  markStripeEventProcessed: (...args: unknown[]) => mockMarkStripeEventProcessed(...args),
  getOrCreateProfile: (...args: unknown[]) => mockGetOrCreateProfile(...args),
  updateProfileById: (...args: unknown[]) => mockUpdateProfileById(...args),
  findProfileBySubscriptionId: (...args: unknown[]) => mockFindProfileBySubscriptionId(...args),
  getAdminTables: () => ({
    createRow: (...args: unknown[]) => mockCreateRow(...args),
  }),
}));

function makeRequest(body: string, signature: string | null) {
  return {
    text: jest.fn().mockResolvedValue(body),
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'stripe-signature') return signature;
        return null;
      },
    },
  };
}

async function loadPost() {
  const mod = await import('@/app/api/webhook/stripe/route');
  return mod.POST;
}

describe('POST /api/webhook/stripe', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.STRIPE_SECRET_KEY = 'STRIPE_TEST_SECRET_KEY_MOCK';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';
    mockEnsureCoreAppwriteResources.mockResolvedValue(undefined);
    mockMarkStripeEventProcessed.mockResolvedValue(false);
    mockRetrieveSubscription.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      cancel_at_period_end: false,
      items: { data: [{ current_period_start: 1_700_000_000, current_period_end: 1_700_864_000, price: { recurring: { interval: 'month' } } }] },
    });
    mockGetOrCreateProfile.mockResolvedValue({ id: 'user-1', rapido_pens: 3, is_premium: false });
    mockUpdateProfileById.mockResolvedValue(undefined);
    mockFindProfileBySubscriptionId.mockResolvedValue(null);
    mockCreateRow.mockResolvedValue(undefined);
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const POST = await loadPost();
    const response = await POST(makeRequest('{}', null) as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing stripe-signature header',
    });
  });

  it('skips duplicate events and returns 200', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_duplicate',
      type: 'checkout.session.completed',
      data: { object: {} },
    });
    mockMarkStripeEventProcessed.mockResolvedValue(true);

    const POST = await loadPost();
    const response = await POST(makeRequest('body', 'sig') as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(mockUpdateProfileById).not.toHaveBeenCalled();
  });

  it('credits rapido pens after rapido checkout completion', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_rapido',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_rapido',
          metadata: {
            user_id: 'user-1',
            checkout_mode: 'rapido_pack',
            rapido_quantity: '7',
          },
        },
      },
    });
    mockGetOrCreateProfile.mockResolvedValueOnce({ id: 'user-1', rapido_pens: 3, is_premium: false });

    const POST = await loadPost();
    const response = await POST(makeRequest('body', 'sig') as never);

    expect(response.status).toBe(200);
    expect(mockUpdateProfileById).toHaveBeenCalledWith('user-1', { rapido_pens: 10 });
    expect(mockCreateRow).toHaveBeenCalledTimes(1);
  });

  it('activates premium and stores Stripe customer/subscription IDs', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_premium',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_premium',
          customer: 'cus_123',
          subscription: 'sub_123',
          metadata: {
            user_id: 'user-2',
            checkout_mode: 'premium_monthly',
          },
        },
      },
    });
    mockGetOrCreateProfile.mockResolvedValueOnce({ id: 'user-2', rapido_pens: 20, is_premium: false });

    const POST = await loadPost();
    const response = await POST(makeRequest('body', 'sig') as never);

    expect(response.status).toBe(200);
    expect(mockUpdateProfileById).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({
        is_premium: true,
        rapido_pens: 200,
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: 'sub_123',
      }),
    );
    expect(mockCreateRow).toHaveBeenCalledTimes(1);
  });

  it('disables premium on subscription cancellation', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_cancel',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_cancelled_1',
        },
      },
    });
    mockFindProfileBySubscriptionId.mockResolvedValueOnce({ id: 'user-3' });

    const POST = await loadPost();
    const response = await POST(makeRequest('body', 'sig') as never);

    expect(response.status).toBe(200);
    expect(mockUpdateProfileById).toHaveBeenCalledWith(
      'user-3',
      expect.objectContaining({ is_premium: false }),
    );
  });
});
