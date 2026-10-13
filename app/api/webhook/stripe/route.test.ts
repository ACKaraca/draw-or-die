import { FakeTables } from '@/__tests__/helpers/fake-appwrite-tables';
import { STRIPE_PRICES } from '@/lib/pricing';
import { STRIPE_EVENT_LEASE_MS } from '@/lib/stripe-event-ledger';
import { POST } from '@/app/api/webhook/stripe/route';
import { POST as REPLAY } from '@/app/api/webhook/stripe/replay/route';

type Row = Record<string, unknown> & { $id: string };

let mockFake = new FakeTables();
const mockGetUser = jest.fn();
const mockIsAdmin = jest.fn();
const mockStripe = {
  webhooks: { constructEvent: jest.fn() },
  subscriptions: { retrieve: jest.fn() },
  checkout: { sessions: { listLineItems: jest.fn(), list: jest.fn() } },
  refunds: { list: jest.fn() },
  charges: { retrieve: jest.fn() },
  events: { retrieve: jest.fn() },
};

jest.mock('node-appwrite', () => ({
  ID: { unique: () => 'unique()' },
  Query: jest.requireActual('@/__tests__/helpers/fake-appwrite-tables').fakeQuery,
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockStripe),
}));

jest.mock('@/lib/appwrite/resource-bootstrap', () => ({
  ensureCoreAppwriteResources: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/appwrite/server', () => {
  const eq = (attribute: string, value: unknown) => JSON.stringify({ method: 'equal', attribute, values: [value] });
  const normalize = (row: Record<string, unknown>) => ({
    id: String(row.user_id),
    row_id: String(row.$id),
    rapido_pens: Number(row.rapido_pens ?? 0),
    is_premium: Boolean(row.is_premium),
    stripe_customer_id: (row.stripe_customer_id as string) || null,
    stripe_subscription_id: (row.stripe_subscription_id as string) || null,
    subscription_status: (row.subscription_status as string) || null,
    premium_interval: (row.premium_interval as string) || null,
  });
  const findBy = async (column: string, value: string) =>
    (await mockFake.listRows({ tableId: 'profiles', queries: [eq(column, value)] } as never)).rows[0] ?? null;

  return {
    APPWRITE_DATABASE_ID: 'db',
    APPWRITE_TABLE_PROFILES_ID: 'profiles',
    APPWRITE_TABLE_STRIPE_EVENTS_ID: 'stripe_events',
    APPWRITE_TABLE_BILLING_EVENTS_ID: 'billing_events',
    APPWRITE_TABLE_PROMO_CODES_ID: 'promo_codes',
    APPWRITE_TABLE_PROMO_REDEMPTIONS_ID: 'promo_redemptions',
    getAdminTables: () => mockFake,
    normalizeProfileRow: normalize,
    getOrCreateProfile: async (user: { id: string }) => {
      const row = await findBy('user_id', user.id);
      if (row) return normalize(row);
      const created = await mockFake.createRow({
        tableId: 'profiles',
        rowId: 'unique()',
        data: { user_id: user.id, rapido_pens: 15, is_premium: false },
      } as never);
      return normalize(created);
    },
    findProfileBySubscriptionId: async (subscriptionId: string) => {
      const row = await findBy('stripe_subscription_id', subscriptionId);
      return row ? normalize(row) : null;
    },
    updateProfileById: async (userId: string, data: Record<string, unknown>) => {
      const row = await findBy('user_id', userId);
      if (!row) throw new Error(`Profile not found for user: ${userId}`);
      return mockFake.updateRow({ tableId: 'profiles', rowId: row.$id, data } as never);
    },
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
    getAuthenticatedUserFromRequest: (...args: unknown[]) => mockGetUser(...args),
    isVerifiedAdmin: (...args: unknown[]) => mockIsAdmin(...args),
  };
});

const GLOBAL = STRIPE_PRICES.GLOBAL;
let eventCounter = 0;

function makeEvent(type: string, object: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  eventCounter += 1;
  return { id: `evt_test${eventCounter}`, type, livemode: false, created: 1_700_000_000 + eventCounter, data: { object }, ...overrides };
}

function makeRequest(body: string, signature: string | null = 'sig') {
  return {
    text: jest.fn().mockResolvedValue(body),
    headers: { get: (name: string) => (name.toLowerCase() === 'stripe-signature' ? signature : null) },
  };
}

async function deliver(event: Record<string, unknown>) {
  const response = await POST(makeRequest(JSON.stringify(event)) as never);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

function rapidoSession(overrides: Record<string, unknown> = {}, metadata: Record<string, string> = {}) {
  return {
    id: 'cs_rapido',
    object: 'checkout.session',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    currency: 'usd',
    amount_total: GLOBAL.RAPIDO_UNIT * 10,
    client_reference_id: 'user-1',
    customer: 'cus_1',
    payment_intent: 'pi_rapido',
    subscription: null,
    total_details: { amount_discount: 0 },
    metadata: {
      user_id: 'user-1',
      checkout_mode: 'rapido_pack',
      rapido_quantity: '10',
      pricing_tier: 'GLOBAL',
      promo_source: '',
      ...metadata,
    },
    ...overrides,
  };
}

function rapidoLineItem(overrides: Record<string, unknown> = {}, priceOverrides: Record<string, unknown> = {}) {
  return {
    price: {
      id: GLOBAL.PRICE_IDS.RAPIDO,
      product: STRIPE_PRICES.RAPIDO_PRODUCT_ID,
      unit_amount: GLOBAL.RAPIDO_UNIT,
      currency: 'usd',
      recurring: null,
      ...priceOverrides,
    },
    quantity: 10,
    amount_subtotal: GLOBAL.RAPIDO_UNIT * 10,
    currency: 'usd',
    ...overrides,
  };
}

function premiumSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_premium',
    object: 'checkout.session',
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    currency: 'usd',
    amount_total: GLOBAL.MONTHLY,
    created: 1_700_000_000,
    client_reference_id: 'user-1',
    customer: 'cus_1',
    subscription: 'sub_1',
    payment_intent: null,
    total_details: { amount_discount: 0 },
    metadata: { user_id: 'user-1', checkout_mode: 'premium_monthly', rapido_quantity: '0', pricing_tier: 'GLOBAL' },
    ...overrides,
  };
}

const premiumLineItem = {
  price: {
    id: GLOBAL.PRICE_IDS.MONTHLY,
    product: GLOBAL.PRODUCT_ID,
    unit_amount: GLOBAL.MONTHLY,
    currency: 'usd',
    recurring: { interval: 'month' },
  },
  quantity: 1,
  amount_subtotal: GLOBAL.MONTHLY,
  currency: 'usd',
};

let subscriptionState: Record<string, unknown>;
let lineItemsBySession: Record<string, unknown[]>;

function setSubscriptionStatus(status: string) {
  subscriptionState = { ...subscriptionState, status, ended_at: status === 'canceled' ? 1_700_100_000 : null };
}

function profile(userId = 'user-1'): Row {
  const row = mockFake.rows('profiles').find((entry) => entry.user_id === userId);
  if (!row) throw new Error('profile missing');
  return row;
}

function eventRow(eventId: string): Row | undefined {
  return mockFake.rows('stripe_events').find((row) => row.event_id === eventId);
}

function ledger(eventType?: string): Row[] {
  return mockFake.rows('billing_events').filter((row) => !eventType || row.event_type === eventType);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFake = new FakeTables();
  process.env.STRIPE_SECRET_KEY = 'STRIPE_TEST_SECRET_KEY_MOCK';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';
  delete process.env.STRIPE_WEBHOOK_PAUSED;
  process.env.STRIPE_EXPECTED_LIVEMODE = 'false';
  delete process.env.STRIPE_ACCOUNT_ID;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'info').mockImplementation(() => undefined);

  mockFake.seed('profiles', { $id: 'prow_1', user_id: 'user-1', rapido_pens: 3, is_premium: false });

  mockStripe.webhooks.constructEvent.mockImplementation((body: string, signature: string) => {
    if (signature !== 'sig') throw new Error('Invalid signature');
    return JSON.parse(body);
  });

  lineItemsBySession = { cs_rapido: [rapidoLineItem()], cs_premium: [premiumLineItem] };
  mockStripe.checkout.sessions.listLineItems.mockImplementation(async (id: string) => ({ data: lineItemsBySession[id] ?? [] }));
  mockStripe.checkout.sessions.list.mockImplementation(async ({ payment_intent }: { payment_intent: string }) => ({
    data: payment_intent === 'pi_rapido' ? [rapidoSession()] : [],
  }));

  subscriptionState = {
    id: 'sub_1',
    status: 'active',
    currency: 'usd',
    customer: 'cus_1',
    cancel_at_period_end: false,
    ended_at: null,
    items: {
      data: [{
        current_period_start: 1_700_000_000,
        current_period_end: 1_702_592_000,
        price: { id: GLOBAL.PRICE_IDS.MONTHLY, product: GLOBAL.PRODUCT_ID, recurring: { interval: 'month' } },
      }],
    },
  };
  mockStripe.subscriptions.retrieve.mockImplementation(async () => ({ ...subscriptionState }));
});

describe('POST /api/webhook/stripe — verification', () => {
  it('returns 400 when the stripe-signature header is missing', async () => {
    const response = await POST(makeRequest('{}', null) as never);
    expect(response.status).toBe(400);
  });

  it('returns 400 and records nothing when the signature is invalid', async () => {
    const response = await POST(makeRequest(JSON.stringify(makeEvent('checkout.session.completed', rapidoSession())), 'bad') as never);
    expect(response.status).toBe(400);
    expect(mockFake.rows('stripe_events')).toHaveLength(0);
  });

  it('returns 503 without claiming while processing is paused', async () => {
    process.env.STRIPE_WEBHOOK_PAUSED = 'true';
    const { status } = await deliver(makeEvent('checkout.session.completed', rapidoSession()));
    expect(status).toBe(503);
    expect(mockFake.rows('stripe_events')).toHaveLength(0);
  });

  it('fails closed (503) when the event ledger is unavailable', async () => {
    mockFake.failOnce('createRow', (params) => params.tableId === 'stripe_events');
    const { status } = await deliver(makeEvent('checkout.session.completed', rapidoSession()));
    expect(status).toBe(503);
    expect(profile().rapido_pens).toBe(3);
  });

  it.each([
    ['livemode', { livemode: true }, {}],
    ['connected account', { account: 'acct_other' }, {}],
    ['configured account mismatch', { account: 'acct_other' }, { STRIPE_ACCOUNT_ID: 'acct_mine' }],
  ])('rejects (and records) events with a wrong %s without side effects', async (_label, overrides, env) => {
    Object.assign(process.env, env);
    const event = makeEvent('checkout.session.completed', rapidoSession(), overrides);
    const { status } = await deliver(event);

    expect(status).toBe(200);
    expect(eventRow(event.id)).toMatchObject({ status: 'rejected', outcome: expect.stringMatching(/mismatch/) });
    expect(profile().rapido_pens).toBe(3);
    expect(ledger()).toHaveLength(0);
  });

  it('acknowledges unknown event types without side effects and keeps an audit row', async () => {
    const event = makeEvent('customer.tax_id.created', { id: 'txi_1' });
    const { status } = await deliver(event);

    expect(status).toBe(200);
    expect(eventRow(event.id)).toMatchObject({ status: 'ignored', outcome: 'unhandled_event_type', event_type: 'customer.tax_id.created' });
    expect(ledger()).toHaveLength(0);
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
});

describe('POST /api/webhook/stripe — exactly-once processing', () => {
  it('credits a Rapido pack once for duplicate deliveries of the same event', async () => {
    const event = makeEvent('checkout.session.completed', rapidoSession());

    const first = await deliver(event);
    const second = await deliver(event);

    expect(first).toEqual({ status: 200, body: { received: true, status: 'succeeded' } });
    expect(second.body).toEqual({ received: true, duplicate: true });
    expect(profile().rapido_pens).toBe(13);
    expect(ledger('rapido_pack')).toHaveLength(1);
    expect(eventRow(event.id)).toMatchObject({ status: 'succeeded', attempts: 1, outcome: 'rapido_pack_granted' });
  });

  it('credits once when Stripe sends completed and async_payment_succeeded for one session', async () => {
    await deliver(makeEvent('checkout.session.completed', rapidoSession()));
    await deliver(makeEvent('checkout.session.async_payment_succeeded', rapidoSession()));

    expect(profile().rapido_pens).toBe(13);
    expect(ledger('rapido_pack')).toHaveLength(1);
  });

  it('lets only one of two concurrent deliveries process the event', async () => {
    const event = makeEvent('checkout.session.completed', rapidoSession());
    const results = await Promise.all([deliver(event), deliver(event)]);

    const statuses = results.map((result) => result.status).sort();
    expect(statuses[0]).toBe(200);
    expect([200, 409]).toContain(statuses[1]);
    expect(profile().rapido_pens).toBe(13);
    expect(ledger('rapido_pack')).toHaveLength(1);
  });

  it('returns 409 while another worker holds a live lease, and takes over a stale lease', async () => {
    const event = makeEvent('checkout.session.completed', rapidoSession());
    mockFake.seed('stripe_events', {
      $id: 'ev_row',
      event_id: event.id,
      status: 'processing',
      attempts: 1,
      lease_owner: 'other-worker',
      lease_expires_at: new Date(Date.now() + STRIPE_EVENT_LEASE_MS).toISOString(),
    });

    expect((await deliver(event)).status).toBe(409);
    expect(profile().rapido_pens).toBe(3);

    mockFake.table('stripe_events').get('ev_row')!.lease_expires_at = new Date(Date.now() - 1_000).toISOString();
    expect((await deliver(event)).status).toBe(200);
    expect(eventRow(event.id)).toMatchObject({ status: 'succeeded', attempts: 2 });
    expect(profile().rapido_pens).toBe(13);
  });

  it('lets only one worker win a takeover race on the same failed event', async () => {
    const event = makeEvent('checkout.session.completed', rapidoSession());
    mockFake.seed('stripe_events', { $id: 'ev_row', event_id: event.id, status: 'failed', attempts: 1, lease_owner: '' });

    const results = await Promise.all([deliver(event), deliver(event), deliver(event)]);
    expect(results.filter((result) => result.body.status === 'succeeded')).toHaveLength(1);
    expect(profile().rapido_pens).toBe(13);
    expect(eventRow(event.id)).toMatchObject({ attempts: 2 });
  });

  const injectionPoints: Array<[string, () => void]> = [
    ['line item lookup (before any effect)', () => mockStripe.checkout.sessions.listLineItems.mockRejectedValueOnce(new Error('stripe down'))],
    ['profile lookup', () => mockFake.failOnce('listRows', (params) => params.tableId === 'profiles')],
    ['ledger idempotency check', () => mockFake.failOnce('getRow', (params) => params.tableId === 'billing_events')],
    ['balance change inside the transaction', () => mockFake.failOnce('incrementRowColumn', (params) => params.tableId === 'profiles')],
    ['transaction commit', () => mockFake.failOnce('updateTransaction', (params) => params.commit === true)],
    ['final event-state write (after the effect)', () =>
      mockFake.failOnce('updateRow', (params) => params.tableId === 'stripe_events' && params.data.status === 'succeeded')],
  ];

  it.each(injectionPoints)('retries a failure at %s to exactly one credit', async (_label, inject) => {
    const event = makeEvent('checkout.session.completed', rapidoSession());
    inject();

    const first = await deliver(event);
    expect(first.status).toBe(500);
    expect(eventRow(event.id)).toMatchObject({ status: 'failed', attempts: 1, last_error: expect.stringContaining('') });

    const retry = await deliver(event);
    expect(retry.status).toBe(200);
    expect(profile().rapido_pens).toBe(13);
    expect(ledger('rapido_pack')).toHaveLength(1);
    expect(eventRow(event.id)).toMatchObject({ status: 'succeeded', attempts: 2 });
  });

  it('falls back to marker-then-balance when transactions are unavailable, still exactly once', async () => {
    const event = makeEvent('checkout.session.completed', rapidoSession());
    mockFake.failOnce('createTransaction');
    mockFake.failOnce('incrementRowColumn', (params) => params.tableId === 'profiles');
    mockFake.failOnce('createTransaction');

    expect((await deliver(event)).status).toBe(500);
    expect(ledger()).toHaveLength(0);
    expect((await deliver(event)).status).toBe(200);
    expect(profile().rapido_pens).toBe(13);
    expect(ledger('rapido_pack')).toHaveLength(1);
  });

  it('keeps failed events replayable: dry-run reads only, execution needs explicit ids and admin', async () => {
    const event = makeEvent('checkout.session.completed', rapidoSession());
    mockStripe.checkout.sessions.listLineItems.mockRejectedValueOnce(new Error('stripe down'));
    await deliver(event);
    mockStripe.events.retrieve.mockResolvedValue(event);

    const replayRequest = (body: unknown) => ({ json: async () => body, headers: { get: () => null } });

    mockGetUser.mockResolvedValue({ id: 'admin-1', email: 'a@x.com', emailVerified: true });
    mockIsAdmin.mockReturnValue(false);
    expect((await REPLAY(replayRequest({ eventIds: [event.id], dryRun: false }) as never)).status).toBe(403);

    mockIsAdmin.mockReturnValue(true);
    const list = await REPLAY(replayRequest({}) as never);
    await expect(list.json()).resolves.toMatchObject({
      dryRun: true,
      events: [{ eventId: event.id, stored: { status: 'failed', attempts: 1 } }],
    });

    const dryRun = await REPLAY(replayRequest({ eventIds: [event.id] }) as never);
    expect(dryRun.status).toBe(200);
    expect(profile().rapido_pens).toBe(3);
    expect(eventRow(event.id)).toMatchObject({ status: 'failed' });

    expect((await REPLAY(replayRequest({ dryRun: false }) as never)).status).toBe(400);

    const execute = await REPLAY(replayRequest({ eventIds: [event.id], dryRun: false }) as never);
    await expect(execute.json()).resolves.toMatchObject({ events: [{ result: { kind: 'processed', status: 'succeeded' } }] });
    expect(profile().rapido_pens).toBe(13);
    expect(eventRow(event.id)).toMatchObject({ status: 'succeeded', attempts: 2 });
    expect(mockFake.rows('stripe_events')).toHaveLength(1);
  });
});

describe('POST /api/webhook/stripe — purchase validation', () => {
  it.each<[string, () => void, string]>([
    ['price', () => { lineItemsBySession.cs_rapido = [rapidoLineItem({}, { id: 'price_other', product: 'prod_other' })]; }, 'price_mismatch'],
    ['unit amount', () => {
      lineItemsBySession.cs_rapido = [rapidoLineItem({ amount_subtotal: 10 }, { unit_amount: 1 })];
    }, 'amount_mismatch'],
    ['currency', () => { lineItemsBySession.cs_rapido = [rapidoLineItem({ currency: 'try' }, { currency: 'try' })]; }, 'currency_mismatch'],
    ['quantity', () => {
      lineItemsBySession.cs_rapido = [rapidoLineItem({ quantity: 2000, amount_subtotal: GLOBAL.RAPIDO_UNIT * 2000 })];
    }, 'quantity_mismatch'],
  ])('never grants when the %s does not match pricing', async (_label, mutate, reason) => {
    mutate();
    const event = makeEvent('checkout.session.completed', rapidoSession());
    const { status } = await deliver(event);

    expect(status).toBe(200);
    expect(eventRow(event.id)).toMatchObject({ status: 'rejected', outcome: reason });
    expect(profile().rapido_pens).toBe(3);
    expect(ledger('checkout_rejected')).toEqual([expect.objectContaining({ rapido_delta: 0 })]);
  });

  it('rejects an internal promo that was stacked with a Stripe discount', async () => {
    const session = rapidoSession(
      { total_details: { amount_discount: 100 } },
      { promo_source: 'internal', expected_unit_amount: String(GLOBAL.RAPIDO_UNIT) },
    );
    const event = makeEvent('checkout.session.completed', session);
    await deliver(event);
    expect(eventRow(event.id)).toMatchObject({ status: 'rejected', outcome: 'double_discount' });
    expect(profile().rapido_pens).toBe(3);
  });

  it('grants nothing while an async payment is pending, then once when it clears', async () => {
    const pending = makeEvent('checkout.session.completed', rapidoSession({ payment_status: 'unpaid' }));
    await deliver(pending);
    expect(eventRow(pending.id)).toMatchObject({ status: 'succeeded', outcome: 'awaiting_async_payment' });
    expect(profile().rapido_pens).toBe(3);

    await deliver(makeEvent('checkout.session.async_payment_succeeded', rapidoSession()));
    expect(profile().rapido_pens).toBe(13);
  });
});

describe('POST /api/webhook/stripe — subscription lifecycle', () => {
  it('activates premium from Stripe state and tops the balance up to the allowance once', async () => {
    const event = makeEvent('checkout.session.completed', premiumSession());
    await deliver(event);
    await deliver(makeEvent('checkout.session.completed', premiumSession()));

    expect(profile()).toMatchObject({
      is_premium: true,
      rapido_pens: 200,
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
      subscription_status: 'active',
    });
    expect(ledger('premium_monthly')).toEqual([expect.objectContaining({ rapido_delta: 197 })]);
  });

  it('retries a failure after the allowance grant without granting twice', async () => {
    mockStripe.subscriptions.retrieve.mockRejectedValueOnce(new Error('stripe down'));
    const event = makeEvent('checkout.session.completed', premiumSession());

    expect((await deliver(event)).status).toBe(500);
    expect(profile().rapido_pens).toBe(200);
    profile().rapido_pens = 150; // user spends between deliveries

    expect((await deliver(event)).status).toBe(200);
    expect(profile()).toMatchObject({ rapido_pens: 150, is_premium: true });
    expect(ledger('premium_monthly')).toHaveLength(1);
  });

  it('refills the allowance on renewal invoices once per invoice', async () => {
    await deliver(makeEvent('checkout.session.completed', premiumSession()));
    profile().rapido_pens = 40;

    const invoice = {
      id: 'in_renew_1',
      status: 'paid',
      billing_reason: 'subscription_cycle',
      amount_paid: GLOBAL.MONTHLY,
      currency: 'usd',
      customer: 'cus_1',
      parent: { subscription_details: { subscription: 'sub_1' } },
    };
    await deliver(makeEvent('invoice.paid', invoice));
    await deliver(makeEvent('invoice.paid', invoice));

    expect(profile().rapido_pens).toBe(200);
    expect(ledger('premium_renewal')).toEqual([expect.objectContaining({ rapido_delta: 160 })]);
  });

  it('does not grant a renewal allowance for the first invoice or a currency mismatch', async () => {
    await deliver(makeEvent('checkout.session.completed', premiumSession()));
    profile().rapido_pens = 40;

    const base = { status: 'paid', amount_paid: GLOBAL.MONTHLY, customer: 'cus_1', parent: { subscription_details: { subscription: 'sub_1' } } };
    await deliver(makeEvent('invoice.paid', { ...base, id: 'in_first', billing_reason: 'subscription_create', currency: 'usd' }));
    const mismatch = makeEvent('invoice.paid', { ...base, id: 'in_eur', billing_reason: 'subscription_cycle', currency: 'eur' });
    await deliver(mismatch);

    expect(profile().rapido_pens).toBe(40);
    expect(eventRow(mismatch.id)).toMatchObject({ status: 'rejected', outcome: 'currency_mismatch' });
  });

  it('revokes premium on cancellation and records the end without touching the balance', async () => {
    await deliver(makeEvent('checkout.session.completed', premiumSession()));
    setSubscriptionStatus('canceled');
    const deleted = makeEvent('customer.subscription.deleted', { id: 'sub_1' });
    await deliver(deleted);
    await deliver(makeEvent('customer.subscription.deleted', { id: 'sub_1' }));

    expect(profile()).toMatchObject({ is_premium: false, subscription_status: 'canceled', rapido_pens: 200 });
    expect(ledger('premium_ended')).toHaveLength(1);
  });

  it('converges to the same state when cancellation is processed before checkout completion', async () => {
    const run = async (order: 'in-order' | 'reversed') => {
      mockFake = new FakeTables();
      mockFake.seed('profiles', { $id: 'prow_1', user_id: 'user-1', rapido_pens: 3, is_premium: false });
      subscriptionState = { ...subscriptionState, status: 'active' };
      const completed = makeEvent('checkout.session.completed', premiumSession());
      const updated = makeEvent('customer.subscription.updated', { id: 'sub_1', status: 'active' });
      const deleted = makeEvent('customer.subscription.deleted', { id: 'sub_1' });

      if (order === 'in-order') {
        await deliver(completed);
        await deliver(updated);
        setSubscriptionStatus('canceled');
        await deliver(deleted);
      } else {
        setSubscriptionStatus('canceled');
        await deliver(deleted);
        await deliver(updated);
        await deliver(completed);
      }
      await deliver(deleted);

      const { is_premium, rapido_pens, subscription_status } = profile();
      return {
        state: { is_premium, rapido_pens, subscription_status },
        ledger: ledger().map((row) => `${row.event_type}:${row.rapido_delta}`).sort(),
      };
    };

    const inOrder = await run('in-order');
    const reversed = await run('reversed');
    expect(reversed).toEqual(inOrder);
    expect(inOrder.state).toEqual({ is_premium: false, rapido_pens: 200, subscription_status: 'canceled' });
  });

  it('does not keep premium for a subscription on an unknown price', async () => {
    await deliver(makeEvent('checkout.session.completed', premiumSession()));
    subscriptionState = {
      ...subscriptionState,
      items: { data: [{ price: { id: 'price_foreign', product: 'prod_foreign', recurring: { interval: 'month' } } }] },
    };
    const updated = makeEvent('customer.subscription.updated', { id: 'sub_1' });
    await deliver(updated);

    expect(profile().is_premium).toBe(false);
    expect(eventRow(updated.id)).toMatchObject({ status: 'rejected', outcome: 'unknown_subscription_price' });
  });
});

describe('POST /api/webhook/stripe — refunds and disputes', () => {
  beforeEach(async () => {
    await deliver(makeEvent('checkout.session.completed', rapidoSession()));
  });

  const charge = { id: 'ch_1', amount: GLOBAL.RAPIDO_UNIT * 10, currency: 'usd', customer: 'cus_1', payment_intent: 'pi_rapido' };

  it('revokes Rapido proportionally per refund and never twice', async () => {
    mockStripe.refunds.list.mockResolvedValue({ data: [{ id: 're_1', status: 'succeeded', amount: GLOBAL.RAPIDO_UNIT * 4 }] });
    await deliver(makeEvent('charge.refunded', charge));
    await deliver(makeEvent('charge.refunded', charge));
    expect(profile().rapido_pens).toBe(9);

    mockStripe.refunds.list.mockResolvedValue({
      data: [
        { id: 're_1', status: 'succeeded', amount: GLOBAL.RAPIDO_UNIT * 4 },
        { id: 're_2', status: 'succeeded', amount: GLOBAL.RAPIDO_UNIT * 6 },
      ],
    });
    await deliver(makeEvent('charge.refunded', charge));

    expect(profile().rapido_pens).toBe(3);
    expect(ledger('rapido_pack_refund').map((row) => row.rapido_delta).sort()).toEqual([-4, -6]);
    expect(ledger('rapido_pack')).toHaveLength(1);
  });

  it('clamps a refund revocation at zero when the Rapido were already spent', async () => {
    profile().rapido_pens = 2;
    mockStripe.refunds.list.mockResolvedValue({ data: [{ id: 're_full', status: 'succeeded', amount: charge.amount }] });
    await deliver(makeEvent('charge.refunded', charge));

    expect(profile().rapido_pens).toBe(0);
    expect(ledger('rapido_pack_refund')).toEqual([expect.objectContaining({ rapido_delta: -2 })]);
    expect(JSON.parse(String(ledger('rapido_pack_refund')[0].metadata_json))).toMatchObject({ requestedRevocation: 10 });
  });

  it('records an opened dispute without changing access and revokes when the dispute is lost', async () => {
    mockStripe.charges.retrieve.mockResolvedValue(charge);
    const dispute = { id: 'dp_1', charge: 'ch_1', amount: charge.amount, status: 'needs_response', reason: 'fraudulent' };

    await deliver(makeEvent('charge.dispute.created', dispute));
    expect(profile().rapido_pens).toBe(13);
    expect(ledger('rapido_pack_dispute_opened')).toHaveLength(1);

    await deliver(makeEvent('charge.dispute.closed', { ...dispute, status: 'lost' }));
    await deliver(makeEvent('charge.dispute.closed', { ...dispute, status: 'lost' }));
    expect(profile().rapido_pens).toBe(3);
    expect(ledger('rapido_pack_dispute_lost')).toEqual([expect.objectContaining({ rapido_delta: -10 })]);
  });

  it('records a subscription refund for review without revoking access', async () => {
    mockFake.table('profiles').get('prow_1')!.stripe_customer_id = 'cus_1';
    mockStripe.refunds.list.mockResolvedValue({ data: [{ id: 're_sub', status: 'succeeded', amount: 1500 }] });
    await deliver(makeEvent('charge.refunded', { ...charge, id: 'ch_sub', payment_intent: 'pi_invoice', amount: 1500 }));

    expect(profile().rapido_pens).toBe(13);
    expect(ledger('premium_refund')).toEqual([expect.objectContaining({ rapido_delta: 0, amount_cents: 0 })]);
    expect(JSON.parse(String(ledger('premium_refund')[0].metadata_json))).toMatchObject({ reversedAmountCents: 1500 });
  });
});

describe('POST /api/webhook/stripe — promo reservations', () => {
  it('releases an internal promo reservation exactly once when the session expires', async () => {
    mockFake.seed('promo_codes', { $id: 'promo_1', code: 'HALF', used_count: 1 });
    mockFake.seed('promo_redemptions', {
      $id: 'res_1',
      promo_code_id: 'promo_1',
      user_id: 'user-1',
      status: 'reserved',
      metadata_json: JSON.stringify({ slotKey: 'promo-checkout:promo_1:user-1:1', isCounterReserved: true }),
    });
    mockFake.seed('stripe_events', { $id: 'slot', event_id: 'promo-checkout:promo_1:user-1:1', processed_at: '2026-01-01' });

    const session = rapidoSession({ status: 'expired', payment_status: 'unpaid' }, { promo_reservation_id: 'res_1' });
    await deliver(makeEvent('checkout.session.expired', session));
    await deliver(makeEvent('checkout.session.expired', session));

    expect(mockFake.table('promo_codes').get('promo_1')!.used_count).toBe(0);
    expect(mockFake.table('promo_redemptions').get('res_1')!.status).toBe('released');
    expect(mockFake.table('stripe_events').has('slot')).toBe(false);
  });

  it('marks the reservation redeemed when the discounted checkout is paid', async () => {
    mockFake.seed('promo_redemptions', { $id: 'res_2', promo_code_id: 'promo_1', user_id: 'user-1', status: 'reserved' });
    const discountedUnit = 40;
    lineItemsBySession.cs_rapido = [rapidoLineItem({ amount_subtotal: discountedUnit * 10 }, { id: 'price_adhoc', unit_amount: discountedUnit })];
    const session = rapidoSession(
      { amount_total: discountedUnit * 10 },
      { promo_source: 'internal', promo_reservation_id: 'res_2', expected_unit_amount: String(discountedUnit) },
    );

    await deliver(makeEvent('checkout.session.completed', session));

    expect(mockFake.table('promo_redemptions').get('res_2')).toMatchObject({ status: 'redeemed', stripe_session_id: 'cs_rapido' });
    expect(profile().rapido_pens).toBe(13);
  });
});
