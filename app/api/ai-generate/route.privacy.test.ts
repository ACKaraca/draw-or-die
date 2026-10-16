/** @jest-environment node */
import type { NextRequest } from 'next/server';

import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { getOrCreateProfile } from '@/lib/appwrite/server';
import { InMemoryDeletionStore } from '@/lib/privacy/__testing__/fake-privacy-port';
import { createDeletionRequest } from '@/lib/privacy/deletion';
import { resetSubjectGuardCache } from '@/lib/privacy/subject-guard';

jest.mock('next/server', () => ({
  after: jest.fn(),
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
      cookies: { set: jest.fn() },
    }),
  },
}));

jest.mock('@/lib/appwrite/server', () => ({
  ...jest.requireActual('@/lib/appwrite/server'),
  getAuthenticatedUserFromRequest: async () => ({ id: 'user_a', email: 'a@example.com', name: null }),
  getOrCreateProfile: jest.fn(),
}));
jest.mock('@/lib/appwrite/resource-bootstrap', () => ({ ensureCoreAppwriteResources: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logServerError: jest.fn(), logServerInfo: jest.fn() }));

const mockDeletionStore = new InMemoryDeletionStore();
jest.mock('@/lib/privacy/deletion-store', () => ({
  createAppwriteDeletionStore: () => mockDeletionStore,
}));

function buildRequest(): NextRequest {
  return {
    headers: new Headers({ 'accept-language': 'en' }),
    cookies: { get: () => undefined },
    json: async () => ({ operation: 'SINGLE_JURY', params: {} }),
  } as unknown as NextRequest;
}

describe('POST /api/ai-generate deletion tombstone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeletionStore.records.clear();
    resetSubjectGuardCache();
  });

  it('refuses AI processing for a subject with a deletion request before touching the profile', async () => {
    await mockDeletionStore.save(createDeletionRequest('user_a', null, new Date()));
    const { POST } = await import('@/app/api/ai-generate/route');

    const response = await POST(buildRequest());

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_DELETION_REQUESTED' });
    expect(ensureCoreAppwriteResources).not.toHaveBeenCalled();
    expect(getOrCreateProfile).not.toHaveBeenCalled();
  });

  it('fails closed when the deletion store is unavailable', async () => {
    jest.spyOn(mockDeletionStore, 'get').mockRejectedValueOnce(new Error('down'));
    const { POST } = await import('@/app/api/ai-generate/route');

    const response = await POST(buildRequest());

    expect(response.status).toBe(503);
    expect(getOrCreateProfile).not.toHaveBeenCalled();
  });
});
