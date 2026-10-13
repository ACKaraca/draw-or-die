/** @jest-environment node */
import type { NextRequest } from 'next/server';

import { getAuthenticatedUserFromRequest } from '@/lib/appwrite/server';
import { logServerInfo } from '@/lib/logger';
import { InMemoryDeletionStore } from '@/lib/privacy/__testing__/fake-privacy-port';
import { computeSubjectHash, createDeletionRequest } from '@/lib/privacy/deletion';

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
  isVerifiedAdmin: (user: { email: string | null; emailVerified?: boolean }) =>
    user.email === 'admin@example.com' && user.emailVerified === true,
}));
jest.mock('@/lib/logger', () => ({ logServerError: jest.fn(), logServerInfo: jest.fn() }));

const mockDeletionStore = new InMemoryDeletionStore();
jest.mock('@/lib/privacy/deletion-store', () => ({
  createAppwriteDeletionStore: () => mockDeletionStore,
  ensureDeletionRequestsTable: async () => undefined,
}));

const mockedAuth = jest.mocked(getAuthenticatedUserFromRequest);
const ADMIN = { id: 'admin_1', email: 'admin@example.com', name: null, emailVerified: true };
const NOTE = 'Redacted cus_x in Stripe dashboard';

function buildRequest(body: unknown): NextRequest {
  return {
    headers: new Headers({ 'accept-language': 'en' }),
    json: async () => body,
  } as unknown as NextRequest;
}

async function seedManualRequired(userId: string): Promise<void> {
  const record = createDeletionRequest(userId, 'cus_x', new Date());
  record.steps.stripe_customer = { ...record.steps.stripe_customer, status: 'manual_required', reasonCode: 'manual' };
  await mockDeletionStore.save(record);
}

async function loadRoute() {
  return import('@/app/api/account/delete/manual-step/route');
}

describe('POST /api/account/delete/manual-step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeletionStore.records.clear();
    mockedAuth.mockResolvedValue(ADMIN);
  });

  it.each([
    null,
    { id: 'u', email: 'admin@example.com', name: null, emailVerified: false },
    { id: 'u', email: 'user@example.com', name: null, emailVerified: true },
  ])('rejects callers that are not verified admins (%p)', async (user) => {
    mockedAuth.mockResolvedValue(user);
    await seedManualRequired('user_a');
    const { POST } = await loadRoute();

    const response = await POST(buildRequest({ subjectUserId: 'user_a', step: 'stripe_customer', note: NOTE }));

    expect(response.status).toBe(403);
    expect((await mockDeletionStore.get(computeSubjectHash('user_a')))?.steps.stripe_customer.status).toBe(
      'manual_required',
    );
  });

  it.each([
    { subjectUserId: 'user_a', step: 'profile', note: NOTE },
    { subjectUserId: 'user_a', step: 'stripe_customer' },
    { subjectUserId: 'user_a', requestId: 'a'.repeat(64), step: 'stripe_customer', note: NOTE },
    { requestId: 'not-a-hash', step: 'stripe_customer', note: NOTE },
  ])('rejects invalid bodies (%p)', async (body) => {
    const { POST } = await loadRoute();

    const response = await POST(buildRequest(body));

    expect(response.status).toBe(400);
  });

  it('records the manual receipt, completes the request and audits the operator', async () => {
    await seedManualRequired('user_a');
    const { POST } = await loadRoute();

    const response = await POST(buildRequest({ subjectUserId: 'user_a', step: 'stripe_customer', note: NOTE }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ alreadyRecorded: false });
    const stored = await mockDeletionStore.get(computeSubjectHash('user_a'));
    expect(stored?.steps.stripe_customer).toMatchObject({ status: 'done', outcome: 'manual_completed', completedBy: 'owner' });
    expect(stored?.stripeCustomerRef).toBeNull();
    expect(logServerInfo).toHaveBeenCalledWith(
      'privacy.deletion.manual_receipt.admin',
      expect.objectContaining({ operator: 'admin_1', stepId: 'stripe_customer', note: NOTE }),
    );
  });

  it('is idempotent and accepts the request id (subject hash)', async () => {
    await seedManualRequired('user_a');
    const requestId = computeSubjectHash('user_a');
    const { POST } = await loadRoute();

    await POST(buildRequest({ requestId, step: 'stripe_customer', note: NOTE }));
    const savesAfterFirst = mockDeletionStore.saveCount;
    const second = await POST(buildRequest({ requestId, step: 'stripe_customer', note: NOTE }));

    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ alreadyRecorded: true });
    expect(mockDeletionStore.saveCount).toBe(savesAfterFirst);
  });

  it('answers 404 for an unknown request and 409 when the step is not awaiting a receipt', async () => {
    const { POST } = await loadRoute();
    const missing = await POST(buildRequest({ subjectUserId: 'nobody', step: 'stripe_customer', note: NOTE }));
    expect(missing.status).toBe(404);

    await mockDeletionStore.save(createDeletionRequest('user_b', null, new Date()));
    const pending = await POST(buildRequest({ subjectUserId: 'user_b', step: 'stripe_customer', note: NOTE }));
    expect(pending.status).toBe(409);
  });
});
