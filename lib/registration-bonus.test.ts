/** @jest-environment node */
const mockLedger = new Set<string>();
const mockFindStripeEventRow = jest.fn();
const mockCreditRapidoPens = jest.fn();

jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_DATABASE_ID: 'db',
  APPWRITE_TABLE_PROFILES_ID: 'profiles',
  getAdminTables: jest.fn(),
  getAuthUserById: jest.fn(),
  recordBillingEvent: jest.fn().mockResolvedValue({}),
  registrationBonusEntitlementKey: (userId: string) => `registration-bonus-entitled:${userId}`,
}));
jest.mock('@/lib/stripe-event-ledger', () => ({
  findStripeEventRow: (...args: unknown[]) => mockFindStripeEventRow(...args),
}));
jest.mock('@/lib/idempotency', () => ({
  claimOnce: async (key: string) => {
    if (mockLedger.has(key)) return false;
    mockLedger.add(key);
    return true;
  },
  releaseClaim: async (key: string) => {
    mockLedger.delete(key);
  },
}));
jest.mock('@/lib/rapido-balance', () => ({
  creditRapidoPens: (...args: unknown[]) => mockCreditRapidoPens(...args),
}));
jest.mock('@/lib/logger', () => ({ logServerError: jest.fn(), logServerInfo: jest.fn() }));

import type { AppwriteAuthUser, NormalizedUserProfile } from '@/lib/appwrite/server';
import { __resetRegistrationBonusCache, maybeGrantRegistrationBonus } from '@/lib/registration-bonus';

const PROFILE = { id: 'u1', row_id: 'u1', rapido_pens: 15, rapido_fraction_cents: 0 } as NormalizedUserProfile;

function user(overrides: Partial<AppwriteAuthUser> = {}): AppwriteAuthUser {
  return {
    id: 'u1',
    email: 'u1@example.com',
    name: null,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('maybeGrantRegistrationBonus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLedger.clear();
    __resetRegistrationBonusCache();
    mockFindStripeEventRow.mockResolvedValue({ $id: 'marker', event_id: 'registration-bonus-entitled:u1' });
    mockCreditRapidoPens.mockResolvedValue(25);
  });

  it('pays +10 to an unverified registered account and +20 once verified, each exactly once', async () => {
    const unverified = await maybeGrantRegistrationBonus(user({ emailVerified: false }), PROFILE);
    expect(unverified.initial.status).toBe('granted');
    expect(unverified.verified).toEqual({ status: 'ineligible', reason: 'email_unverified' });

    const verified = await maybeGrantRegistrationBonus(user(), PROFILE);
    expect(verified.initial).toEqual({ status: 'not_applicable', reason: 'settled' });
    expect(verified.verified.status).toBe('granted');

    __resetRegistrationBonusCache();
    const again = await maybeGrantRegistrationBonus(user(), PROFILE);
    expect(again.initial.status).toBe('duplicate');
    expect(again.verified.status).toBe('duplicate');

    expect(mockCreditRapidoPens.mock.calls).toEqual([['u1', PROFILE, 10], ['u1', PROFILE, 20]]);
    expect([...mockLedger]).toEqual(['registration-bonus-initial:u1', 'registration-bonus:u1']);
  });

  it('gives anonymous accounts nothing', async () => {
    const result = await maybeGrantRegistrationBonus(user({ email: null }), PROFILE);
    expect(result.initial).toEqual({ status: 'ineligible', reason: 'anonymous' });
    expect(result.verified).toEqual({ status: 'not_applicable', reason: 'initial_not_recorded' });
    expect(mockCreditRapidoPens).not.toHaveBeenCalled();
  });

  it('never pays legacy profiles created without the entitlement marker', async () => {
    mockFindStripeEventRow.mockResolvedValue(null);
    const result = await maybeGrantRegistrationBonus(user(), PROFILE);
    expect(result.initial).toEqual({ status: 'not_applicable', reason: 'legacy_profile' });
    expect(result.verified).toEqual({ status: 'not_applicable', reason: 'initial_not_recorded' });
    expect(mockCreditRapidoPens).not.toHaveBeenCalled();
  });

  it('fails closed when the entitlement lookup errors', async () => {
    mockFindStripeEventRow.mockRejectedValueOnce(new Error('appwrite down'));
    const result = await maybeGrantRegistrationBonus(user(), PROFILE);
    expect(result.initial).toEqual({ status: 'not_applicable', reason: 'entitlement_check_failed' });
    expect(result.verified).toEqual({ status: 'not_applicable', reason: 'initial_not_recorded' });
    expect(mockCreditRapidoPens).not.toHaveBeenCalled();
  });

  it('retries a failed initial grant on the next load and withholds +20 until it is recorded', async () => {
    mockCreditRapidoPens.mockRejectedValueOnce(new Error('write failed'));
    const failed = await maybeGrantRegistrationBonus(user(), PROFILE);
    expect(failed.initial.status).toBe('failed');
    expect(failed.verified).toEqual({ status: 'not_applicable', reason: 'initial_not_recorded' });
    expect(mockLedger.size).toBe(0);

    const retried = await maybeGrantRegistrationBonus(user(), PROFILE);
    expect(retried.initial.status).toBe('granted');
    expect(retried.verified.status).toBe('granted');
  });
});
