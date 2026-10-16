/** @jest-environment node */
import type { NextRequest } from 'next/server';

const mockGetOrCreateProfile = jest.fn();
const mockMaybeGrantRegistrationBonus = jest.fn();

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('@/lib/appwrite/server', () => {
  const actual = jest.requireActual('@/lib/appwrite/server');
  return {
    ...actual,
    APPWRITE_SERVER_API_KEY: 'test-key',
    getAuthenticatedUserFromRequest: async () => ({
      id: 'u1',
      email: 'u1@example.com',
      name: null,
      emailVerified: true,
    }),
    getOrCreateProfile: (...args: unknown[]) => mockGetOrCreateProfile(...args),
    getReferralSignupCountByCode: async () => 2,
  };
});
jest.mock('@/lib/appwrite/resource-bootstrap', () => ({ ensureCoreAppwriteResources: async () => undefined }));
jest.mock('@/lib/registration-bonus', () => ({
  maybeGrantRegistrationBonus: (...args: unknown[]) => mockMaybeGrantRegistrationBonus(...args),
}));
jest.mock('@/lib/privacy/deletion-store', () => ({
  createAppwriteDeletionStore: () => mockDeletionStore,
}));
jest.mock('@/lib/logger', () => ({ logServerError: jest.fn(), logServerInfo: jest.fn() }));

import { GET } from '@/app/api/profile/route';
import { normalizeProfileRow, type UserProfileRow } from '@/lib/appwrite/server';
import { InMemoryDeletionStore } from '@/lib/privacy/__testing__/fake-privacy-port';
import { createDeletionRequest } from '@/lib/privacy/deletion';
import { resetSubjectGuardCache } from '@/lib/privacy/subject-guard';

const mockDeletionStore = new InMemoryDeletionStore();

const SECRET_ROW = {
  $id: 'u1',
  $createdAt: '2026-10-01T00:00:00.000Z',
  user_id: 'u1',
  email: 'u1@example.com',
  rapido_pens: 15,
  referral_code: 'ABCD1234',
  stripe_customer_id: 'cus_secret',
  stripe_subscription_id: 'sub_secret',
  edu_verification_code: '654321',
  edu_otp_hash: 'v1:deadbeef',
  edu_otp_challenge_id: 'challenge-secret',
  edu_otp_attempts: 3,
  edu_otp_delivery: 'sent',
  edu_verification_email: 'student@akdeniz.edu.tr',
} as unknown as UserProfileRow;

describe('GET /api/profile serialization', () => {
  beforeEach(() => {
    mockGetOrCreateProfile.mockResolvedValue(normalizeProfileRow(SECRET_ROW));
    mockMaybeGrantRegistrationBonus.mockResolvedValue({
      initial: { status: 'not_applicable', reason: 'legacy_profile' },
      verified: { status: 'not_applicable', reason: 'initial_not_recorded' },
    });
  });

  it('returns only allow-listed fields', async () => {
    const response = await GET({ headers: new Headers() } as unknown as NextRequest);
    const body = (await response.json()) as { profile: Record<string, unknown> };
    const serialized = JSON.stringify(body);

    for (const secret of ['654321', 'deadbeef', 'challenge-secret', 'cus_secret', 'sub_secret']) {
      expect(serialized).not.toContain(secret);
    }
    for (const key of [
      'edu_verification_code',
      'edu_otp_hash',
      'edu_otp_challenge_id',
      'edu_otp_attempts',
      'edu_otp_delivery',
      'stripe_customer_id',
      'stripe_subscription_id',
      'row_id',
    ]) {
      expect(body.profile).not.toHaveProperty(key);
    }
    expect(body.profile).toMatchObject({
      id: 'u1',
      rapido_pens: 15,
      referral_signup_count: 2,
      edu_verification_email: 'student@akdeniz.edu.tr',
    });
  });

  it('still serves the profile when the registration bonus check throws', async () => {
    mockMaybeGrantRegistrationBonus.mockRejectedValueOnce(new Error('reward failure'));
    const response = await GET({ headers: new Headers() } as unknown as NextRequest);
    expect(response.status).toBe(200);
  });
});

describe('GET /api/profile deletion tombstone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeletionStore.records.clear();
    resetSubjectGuardCache();
  });

  it('does not create or read a profile for a subject with a deletion request', async () => {
    await mockDeletionStore.save(createDeletionRequest('u1', null, new Date()));

    const response = await GET({ headers: new Headers() } as unknown as NextRequest);

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_DELETION_REQUESTED' });
    expect(mockGetOrCreateProfile).not.toHaveBeenCalled();
  });

  it('fails closed when the deletion store is unavailable', async () => {
    jest.spyOn(mockDeletionStore, 'get').mockRejectedValueOnce(new Error('down'));

    const response = await GET({ headers: new Headers() } as unknown as NextRequest);

    expect(response.status).toBe(503);
    expect(mockGetOrCreateProfile).not.toHaveBeenCalled();
  });
});
