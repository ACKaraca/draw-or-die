/** @jest-environment node */
const mockLedger = new Set<string>();
const mockGetProfileRowForUser = jest.fn();
const mockListRows = jest.fn();
const mockCreditRapidoPens = jest.fn();

jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_DATABASE_ID: 'db',
  APPWRITE_TABLE_PROFILES_ID: 'profiles',
  getAdminTables: () => ({ listRows: (...args: unknown[]) => mockListRows(...args) }),
  getProfileRowForUser: (...args: unknown[]) => mockGetProfileRowForUser(...args),
  getAuthUserById: jest.fn(),
  recordBillingEvent: jest.fn().mockResolvedValue({}),
}));
jest.mock('node-appwrite', () => ({
  Query: {
    notEqual: (...args: unknown[]) => ['notEqual', ...args],
    createdAfter: (...args: unknown[]) => ['createdAfter', ...args],
    createdBefore: (...args: unknown[]) => ['createdBefore', ...args],
    limit: (...args: unknown[]) => ['limit', ...args],
  },
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

const ACTIVATION_AT = '2026-10-01T00:00:00.000Z';
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
  const original = process.env.REGISTRATION_BONUS_ACTIVATION_AT;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLedger.clear();
    __resetRegistrationBonusCache();
    process.env.REGISTRATION_BONUS_ACTIVATION_AT = ACTIVATION_AT;
    mockGetProfileRowForUser.mockResolvedValue({ $id: 'u1', $createdAt: '2026-10-05T00:00:00.000Z' });
    mockListRows.mockResolvedValue({ total: 10, rows: [] });
    mockCreditRapidoPens.mockResolvedValue(35);
  });

  afterAll(() => {
    if (original === undefined) delete process.env.REGISTRATION_BONUS_ACTIVATION_AT;
    else process.env.REGISTRATION_BONUS_ACTIVATION_AT = original;
  });

  it('grants the bonus exactly once to a verified early account', async () => {
    const first = await maybeGrantRegistrationBonus(user(), PROFILE);
    __resetRegistrationBonusCache();
    const second = await maybeGrantRegistrationBonus(user(), PROFILE);

    expect(first.status).toBe('granted');
    expect(second.status).toBe('duplicate');
    expect(mockCreditRapidoPens).toHaveBeenCalledTimes(1);
    expect(mockCreditRapidoPens).toHaveBeenCalledWith('u1', PROFILE, 20);
  });

  it('gives anonymous and unverified accounts nothing', async () => {
    expect(await maybeGrantRegistrationBonus(user({ email: null }), PROFILE)).toEqual({ status: 'ineligible', reason: 'anonymous' });
    expect(await maybeGrantRegistrationBonus(user({ emailVerified: false }), PROFILE))
      .toEqual({ status: 'ineligible', reason: 'email_unverified' });
    expect(mockCreditRapidoPens).not.toHaveBeenCalled();
  });

  it('stays paused until the activation timestamp is configured', async () => {
    delete process.env.REGISTRATION_BONUS_ACTIVATION_AT;
    expect(await maybeGrantRegistrationBonus(user(), PROFILE)).toEqual({ status: 'not_applicable', reason: 'paused' });
    expect(mockCreditRapidoPens).not.toHaveBeenCalled();
  });

  it('never pays profiles funded by the legacy create-time bonus', async () => {
    mockGetProfileRowForUser.mockResolvedValue({ $id: 'u1', $createdAt: '2026-09-01T00:00:00.000Z' });
    expect(await maybeGrantRegistrationBonus(user(), PROFILE)).toEqual({ status: 'not_applicable', reason: 'legacy_profile' });
  });

  it('pays nothing outside the cohort or when the cohort check fails', async () => {
    mockListRows.mockResolvedValueOnce({ total: 100, rows: [] });
    expect(await maybeGrantRegistrationBonus(user(), PROFILE)).toMatchObject({ reason: 'outside_cohort' });

    __resetRegistrationBonusCache();
    mockListRows.mockRejectedValueOnce(new Error('appwrite down'));
    expect(await maybeGrantRegistrationBonus(user(), PROFILE)).toMatchObject({ reason: 'cohort_check_failed' });
    expect(mockCreditRapidoPens).not.toHaveBeenCalled();
  });
});
