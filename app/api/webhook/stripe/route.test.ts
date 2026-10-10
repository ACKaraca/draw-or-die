const mockConstructEvent = jest.fn();
const mockRetrieveSubscription = jest.fn();
const mockEnsureCoreAppwriteResources = jest.fn();
const mockMarkStripeEventProcessed = jest.fn();
const mockGetOrCreateProfile = jest.fn();
const mockUpdateProfileById = jest.fn();
const mockFindProfileBySubscriptionId = jest.fn();
const mockCreateRow = jest.fn();
const mockIncrementRowColumn = jest.fn();
const mockListRows = jest.fn();
const mockDeleteRow = jest.fn();

jest.mock('node-appwrite', () => ({
  Query: {
    equal: jest.fn((column: string, value: unknown) => `equal(${column},${String(value)})`),
    limit: jest.fn((value: number) => `limit(${value})`),
  },
}));

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
  APPWRITE_TABLE_PROFILES_ID: 'profiles',
  APPWRITE_TABLE_STRIPE_EVENTS_ID: 'stripe_events',
  markStripeEventProcessed: (...args: unknown[]) => mockMarkStripeEventProcessed(...args),
  getOrCreateProfile: (...args: unknown[]) => mockGetOrCreateProfile(...args),
  updateProfileById: (...args: unknown[]) => mockUpdateProfileById(...args),
  findProfileBySubscriptionId: (...args: unknown[]) => mockFindProfileBySubscriptionId(...args),
  recordBillingEvent: (...args: unknown[]) => mockCreateRow(...args),
  getAdminTables: () => ({
    createRow: (...args: unknown[]) => mockCreateRow(...args),
    incrementRowColumn: (...args: unknown[]) => mockIncrementRowColumn(...args),
    listRows: (...args: unknown[]) => mockListRows(...args),
    deleteRow: (...args: unknown[]) => mockDeleteRow(...args),
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
    mockIncrementRowColumn.mockResolvedValue({ $id: 'profile-row-1', rapido_pens: 10 });
    mockListRows.mockResolvedValue({ total: 1, rows: [{ $id: 'ledger-row-1', event_id: 'evt' }] });
    mockDeleteRow.mockResolvedValue(undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
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
    expect(mockDeleteRow).not.toHaveBeenCalled();
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

  it('credits rapido atomically when the profile row id is known', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_rapido_atomic',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_rapido_atomic',
          amount_total: 3950,
          currency: 'TRY',
          metadata: {
            user_id: 'user-1',
            checkout_mode: 'rapido_pack',
            rapido_quantity: '10',
          },
        },
      },
    });
    mockGetOrCreateProfile.mockResolvedValueOnce({
      id: 'user-1',
      row_id: 'profile-row-1',
      rapido_pens: 3,
      is_premium: false,
    });
    mockIncrementRowColumn.mockResolvedValueOnce({ $id: 'profile-row-1', rapido_pens: 21 });

    const POST = await loadPost();
    const response = await POST(makeRequest('body', 'sig') as never);

    expect(response.status).toBe(200);
    expect(mockIncrementRowColumn).toHaveBeenCalledWith({
      databaseId: 'draw_or_die',
      tableId: 'profiles',
      rowId: 'profile-row-1',
      column: 'rapido_pens',
      value: 10,
    });
    expect(mockUpdateProfileById).not.toHaveBeenCalled();
    expect(mockCreateRow).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        rapidoDelta: 10,
        rapidoBalanceAfter: 21,
        currency: 'try',
      }),
    );
  });

  it('releases the ledger row and returns 500 when the handler fails, so the retry is processed', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_fail',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_fail',
          metadata: {
            user_id: 'user-1',
            checkout_mode: 'rapido_pack',
            rapido_quantity: '5',
          },
        },
      },
    });
    mockGetOrCreateProfile.mockRejectedValueOnce(new Error('Appwrite down'));

    const POST = await loadPost();
    const response = await POST(makeRequest('body', 'sig') as never);

    expect(response.status).toBe(500);
    expect(mockListRows).toHaveBeenCalledWith(
      expect.objectContaining({ databaseId: 'draw_or_die', tableId: 'stripe_events' }),
    );
    expect(mockDeleteRow).toHaveBeenCalledWith({
      databaseId: 'draw_or_die',
      tableId: 'stripe_events',
      rowId: 'ledger-row-1',
    });
  });

  it('still returns 500 when releasing the ledger row fails', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_fail_release',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_fail_release',
          metadata: { user_id: 'user-1', checkout_mode: 'rapido_pack', rapido_quantity: '5' },
        },
      },
    });
    mockGetOrCreateProfile.mockRejectedValueOnce(new Error('Appwrite down'));
    mockListRows.mockRejectedValueOnce(new Error('ledger unavailable'));

    const POST = await loadPost();
    const response = await POST(makeRequest('body', 'sig') as never);

    expect(response.status).toBe(500);
    expect(mockDeleteRow).not.toHaveBeenCalled();
  });

  it('does not touch the ledger on failure when the event was never recorded', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_no_ledger',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_no_ledger',
          metadata: { user_id: 'user-1', checkout_mode: 'rapido_pack', rapido_quantity: '5' },
        },
      },
    });
    mockMarkStripeEventProcessed.mockRejectedValueOnce(new Error('stripe_events table missing'));
    mockGetOrCreateProfile.mockRejectedValueOnce(new Error('Appwrite down'));

    const POST = await loadPost();
    const response = await POST(makeRequest('body', 'sig') as never);

    expect(response.status).toBe(500);
    expect(mockListRows).not.toHaveBeenCalled();
    expect(mockDeleteRow).not.toHaveBeenCalled();
  });

  it('keeps the credit and returns 200 when only the billing ledger write fails', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_billing_fail',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_billing_fail',
          metadata: { user_id: 'user-1', checkout_mode: 'rapido_pack', rapido_quantity: '5' },
        },
      },
    });
    mockCreateRow.mockRejectedValueOnce(new Error('billing_events unavailable'));

    const POST = await loadPost();
    const response = await POST(makeRequest('body', 'sig') as never);

    expect(response.status).toBe(200);
    expect(mockUpdateProfileById).toHaveBeenCalledWith('user-1', { rapido_pens: 8 });
    expect(mockDeleteRow).not.toHaveBeenCalled();
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
