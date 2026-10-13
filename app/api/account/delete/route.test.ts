import { getAuthenticatedUserFromRequest, getProfileRowForUser } from '@/lib/appwrite/server';
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/privacy/constants';
import { runDeletion } from '@/lib/privacy/deletion';
import { checkRateLimit } from '@/lib/rate-limit';

import type { NextRequest } from 'next/server';

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
  getProfileRowForUser: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logServerError: jest.fn(),
  logServerInfo: jest.fn(),
}));

jest.mock('@/lib/privacy/data-port', () => ({
  createAppwritePrivacyPort: jest.fn(() => ({})),
}));

jest.mock('@/lib/privacy/deletion-steps', () => ({
  createDefaultDeletionSteps: jest.fn(() => []),
}));

jest.mock('@/lib/privacy/deletion-store', () => ({
  createAppwriteDeletionStore: jest.fn(() => ({ get: jest.fn(async () => null), save: jest.fn() })),
  ensureDeletionRequestsTable: jest.fn(async () => undefined),
}));

jest.mock('@/lib/privacy/deletion', () => ({
  computeSubjectHash: jest.fn(() => 'hash'),
  runDeletion: jest.fn(),
  toDeletionReceipt: jest.fn((record: { status: string }) => ({ status: record.status })),
}));

const mockedAuth = jest.mocked(getAuthenticatedUserFromRequest);
const mockedProfile = jest.mocked(getProfileRowForUser);
const mockedRateLimit = jest.mocked(checkRateLimit);
const mockedRunDeletion = jest.mocked(runDeletion);

function buildRequest(body: unknown): NextRequest {
  return {
    headers: new Headers({ authorization: 'Bearer jwt', 'accept-language': 'en' }),
    json: async () => {
      if (body === undefined) throw new SyntaxError('no body');
      return body;
    },
  } as unknown as NextRequest;
}

async function loadRoute() {
  return import('@/app/api/account/delete/route');
}

describe('POST /api/account/delete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetAt: Date.now() + 1000 });
    mockedAuth.mockResolvedValue({ id: 'user_a', email: 'a@example.com', name: 'A' });
    mockedProfile.mockResolvedValue(null);
  });

  it('rejects unauthenticated requests', async () => {
    mockedAuth.mockResolvedValue(null);
    const { POST } = await loadRoute();

    const response = await POST(buildRequest({ confirmation: ACCOUNT_DELETION_CONFIRMATION }));

    expect(response.status).toBe(401);
    expect(mockedRunDeletion).not.toHaveBeenCalled();
  });

  it.each([undefined, {}, { confirmation: true }, { confirmation: 'delete_my_account' }])(
    'requires the explicit confirmation value (%p)',
    async (body) => {
      const { POST } = await loadRoute();

      const response = await POST(buildRequest(body));

      expect(response.status).toBe(400);
      expect(mockedRunDeletion).not.toHaveBeenCalled();
    },
  );

  it('is rate limited per user', async () => {
    mockedRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });
    const { POST } = await loadRoute();

    const response = await POST(buildRequest({ confirmation: ACCOUNT_DELETION_CONFIRMATION }));

    expect(response.status).toBe(429);
    expect(mockedRateLimit).toHaveBeenCalledWith('account-delete:user_a', expect.any(Object));
  });

  it('runs the orchestrator with the Stripe reference and answers 202 while not completed', async () => {
    mockedProfile.mockResolvedValue({ stripe_customer_id: ' cus_1 ' } as never);
    mockedRunDeletion.mockResolvedValue({ status: 'blocked' } as never);
    const { POST } = await loadRoute();

    const response = await POST(buildRequest({ confirmation: ACCOUNT_DELETION_CONFIRMATION }));

    expect(response.status).toBe(202);
    expect(mockedRunDeletion).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user_a', stripeCustomerRef: 'cus_1' }));
    await expect(response.json()).resolves.toEqual({ request: { status: 'blocked' } });
  });

  it('answers 200 when the request completed', async () => {
    mockedRunDeletion.mockResolvedValue({ status: 'completed' } as never);
    const { POST } = await loadRoute();

    const response = await POST(buildRequest({ confirmation: ACCOUNT_DELETION_CONFIRMATION }));

    expect(response.status).toBe(200);
  });
});
