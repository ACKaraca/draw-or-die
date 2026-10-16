import { getAuthenticatedUserFromRequest } from '@/lib/appwrite/server';
import { logServerInfo } from '@/lib/logger';
import { buildAccountExport } from '@/lib/privacy/export';
import { checkRateLimit } from '@/lib/rate-limit';

import type { NextRequest } from 'next/server';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200,
      headers: init?.headers ?? {},
      json: async () => body,
    }),
  },
}));

jest.mock('@/lib/appwrite/server', () => ({
  getAuthenticatedUserFromRequest: jest.fn(),
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

jest.mock('@/lib/privacy/export', () => ({
  buildAccountExport: jest.fn(),
}));

const mockedAuth = jest.mocked(getAuthenticatedUserFromRequest);
const mockedRateLimit = jest.mocked(checkRateLimit);
const mockedBuild = jest.mocked(buildAccountExport);

const request = { headers: new Headers({ authorization: 'Bearer jwt' }) } as unknown as NextRequest;

describe('GET /api/account/export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRateLimit.mockResolvedValue({ allowed: true, remaining: 2, resetAt: Date.now() + 1000 });
    mockedAuth.mockResolvedValue({ id: 'user_a', email: 'a@example.com', name: 'A', createdAt: null });
  });

  it('rejects unauthenticated requests', async () => {
    mockedAuth.mockResolvedValue(null);
    const { GET } = await import('@/app/api/account/export/route');

    expect((await GET(request)).status).toBe(401);
    expect(mockedBuild).not.toHaveBeenCalled();
  });

  it('is rate limited per user', async () => {
    mockedRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });
    const { GET } = await import('@/app/api/account/export/route');

    expect((await GET(request)).status).toBe(429);
    expect(mockedRateLimit).toHaveBeenCalledWith('account-export:user_a', expect.any(Object));
  });

  it('exports only the authenticated user, uncached, and writes an audit log', async () => {
    mockedBuild.mockResolvedValue({
      formatVersion: 'v1',
      generatedAt: '2026-10-13T00:00:00.000Z',
      manifest: [{ dataClass: 'profile', count: 1 }],
    } as never);
    const { GET } = await import('@/app/api/account/export/route');

    const response = (await GET(request)) as unknown as { status: number; headers: Record<string, string> };

    expect(response.status).toBe(200);
    expect(response.headers['Cache-Control']).toContain('no-store');
    expect(mockedBuild).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: 'user_a' }) }));
    expect(logServerInfo).toHaveBeenCalledWith('privacy.export.completed', expect.objectContaining({ userId: 'user_a' }));
  });

  it('returns 503 instead of a partial export when collection fails', async () => {
    mockedBuild.mockRejectedValue(new Error('appwrite down'));
    const { GET } = await import('@/app/api/account/export/route');

    expect((await GET(request)).status).toBe(503);
  });
});
