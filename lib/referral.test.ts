const mockGetOrCreateProfile = jest.fn();
const mockGetFeatureFlag = jest.fn();
const mockFindProfileByReferralCode = jest.fn();
const mockUpdateProfileById = jest.fn();
const mockRecordBillingEvent = jest.fn();
const mockClaimOnce = jest.fn();
const mockReleaseClaim = jest.fn();
const mockCreditRapidoPens = jest.fn();
const mockGetAuthUserById = jest.fn();

jest.mock('@/lib/appwrite/server', () => ({
  getOrCreateProfile: (...args: unknown[]) => mockGetOrCreateProfile(...args),
  getFeatureFlag: (...args: unknown[]) => mockGetFeatureFlag(...args),
  findProfileByReferralCode: (...args: unknown[]) => mockFindProfileByReferralCode(...args),
  updateProfileById: (...args: unknown[]) => mockUpdateProfileById(...args),
  recordBillingEvent: (...args: unknown[]) => mockRecordBillingEvent(...args),
  getAuthUserById: (...args: unknown[]) => mockGetAuthUserById(...args),
  getAdminTables: jest.fn(),
}));
jest.mock('@/lib/idempotency', () => ({
  claimOnce: (...args: unknown[]) => mockClaimOnce(...args),
  releaseClaim: (...args: unknown[]) => mockReleaseClaim(...args),
}));
jest.mock('@/lib/rapido-balance', () => ({
  creditRapidoPens: (...args: unknown[]) => mockCreditRapidoPens(...args),
}));
jest.mock('@/lib/logger', () => ({ logServerError: jest.fn(), logServerInfo: jest.fn() }));

import type { AppwriteAuthUser } from '@/lib/appwrite/server';
import { applyReferralReward, linkReferralToUser } from '@/lib/referral';

const NOW_ISO = new Date().toISOString();
const OLD_ISO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

const REFEREE_PROFILE = {
  id: 'new-user',
  row_id: 'new-user',
  email: 'new@example.com',
  rapido_pens: 15,
  rapido_fraction_cents: 0,
  referral_code: 'NEWU1234',
  referred_by: 'ABCD1234',
  referral_rewarded_at: null,
};
const REFERRER_PROFILE = {
  id: 'referrer',
  row_id: 'referrer',
  email: 'referrer@example.com',
  rapido_pens: 3,
  rapido_fraction_cents: 0,
  referral_code: 'ABCD1234',
  referred_by: null,
};

function makeUser(overrides: Partial<AppwriteAuthUser> = {}): AppwriteAuthUser {
  return { id: 'new-user', email: 'new@example.com', name: 'New', emailVerified: true, createdAt: NOW_ISO, ...overrides };
}

describe('referral hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFeatureFlag.mockResolvedValue(null);
    mockGetOrCreateProfile.mockResolvedValue({ ...REFEREE_PROFILE });
    mockFindProfileByReferralCode.mockResolvedValue({ ...REFERRER_PROFILE });
    mockGetAuthUserById.mockResolvedValue({
      id: 'referrer',
      email: 'referrer@example.com',
      name: null,
      emailVerified: true,
      createdAt: OLD_ISO,
    });
    mockClaimOnce.mockResolvedValue(true);
    mockCreditRapidoPens.mockResolvedValue(20);
    mockUpdateProfileById.mockResolvedValue({});
    mockRecordBillingEvent.mockResolvedValue({});
  });

  it('rejects linking from anonymous accounts', async () => {
    const result = await linkReferralToUser(makeUser({ email: null }), 'ABCD1234');
    expect(result.success).toBe(false);
    expect(mockUpdateProfileById).not.toHaveBeenCalled();
  });

  it('rejects linking from old accounts', async () => {
    const result = await linkReferralToUser(makeUser({ createdAt: OLD_ISO }), 'ABCD1234');
    expect(result.success).toBe(false);
  });

  it('rejects linking into an A→B→A cycle', async () => {
    mockGetOrCreateProfile.mockResolvedValue({ ...REFEREE_PROFILE, referred_by: null });
    mockFindProfileByReferralCode.mockResolvedValue({ ...REFERRER_PROFILE, referred_by: 'NEWU1234' });
    const result = await linkReferralToUser(makeUser(), 'ABCD1234');
    expect(result.success).toBe(false);
    expect(mockUpdateProfileById).not.toHaveBeenCalled();
  });

  it('rejects linking into an A→B→C→A cycle and fails closed on chain lookup errors', async () => {
    mockGetOrCreateProfile.mockResolvedValue({ ...REFEREE_PROFILE, referred_by: null });
    mockFindProfileByReferralCode.mockImplementation(async (code: string) => (code === 'ABCD1234'
      ? { ...REFERRER_PROFILE, referred_by: 'CCCC1234' }
      : { ...REFERRER_PROFILE, id: 'c', email: 'c@example.com', referral_code: 'CCCC1234', referred_by: 'NEWU1234' }));
    expect((await linkReferralToUser(makeUser(), 'ABCD1234')).success).toBe(false);

    mockFindProfileByReferralCode.mockImplementation(async (code: string) => {
      if (code === 'ABCD1234') return { ...REFERRER_PROFILE, referred_by: 'CCCC1234' };
      throw new Error('appwrite down');
    });
    expect((await linkReferralToUser(makeUser(), 'ABCD1234')).success).toBe(false);
    expect(mockUpdateProfileById).not.toHaveBeenCalled();
  });

  it('rejects linking a referrer with the same mailbox', async () => {
    mockGetOrCreateProfile.mockResolvedValue({ ...REFEREE_PROFILE, referred_by: null });
    mockFindProfileByReferralCode.mockResolvedValue({ ...REFERRER_PROFILE, email: 'New+alt@Example.com' });
    const result = await linkReferralToUser(makeUser(), 'ABCD1234');
    expect(result.success).toBe(false);
  });

  it('does not reward an unverified email', async () => {
    const result = await applyReferralReward(makeUser({ emailVerified: false }));
    expect(result).toEqual({ success: true, rewarded: false });
    expect(mockCreditRapidoPens).not.toHaveBeenCalled();
  });

  it('rewards both sides once for a verified new account', async () => {
    const result = await applyReferralReward(makeUser());
    expect(result).toEqual({ success: true, rewarded: true, rapido: 5 });
    expect(mockClaimOnce).toHaveBeenCalledWith('referral-reward:new-user');
    expect(mockClaimOnce).toHaveBeenCalledWith('referral-reward-referrer:new-user');
    expect(mockCreditRapidoPens).toHaveBeenCalledTimes(2);
    expect(mockRecordBillingEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'referrer',
      eventType: 'referral_reward_referrer',
      metadata: expect.objectContaining({ idempotency_key: 'referral-reward-referrer:new-user', source_id: 'new-user' }),
    }));
  });

  it('pays nothing when a parallel request already claimed the reward', async () => {
    mockClaimOnce.mockResolvedValue(false);
    const result = await applyReferralReward(makeUser());
    expect(result.rewarded).toBe(false);
    expect(mockCreditRapidoPens).not.toHaveBeenCalled();
  });

  it('releases the claim when crediting fails', async () => {
    mockCreditRapidoPens.mockRejectedValueOnce(new Error('appwrite down'));
    const result = await applyReferralReward(makeUser());
    expect(result.success).toBe(false);
    expect(mockReleaseClaim).toHaveBeenCalledWith('referral-reward:new-user');
  });

  it('settles A→B→A cycles without paying anyone', async () => {
    mockFindProfileByReferralCode.mockResolvedValue({ ...REFERRER_PROFILE, referred_by: 'NEWU1234' });
    const result = await applyReferralReward(makeUser());
    expect(result).toEqual({ success: true, rewarded: false });
    expect(mockClaimOnce).not.toHaveBeenCalled();
    expect(mockCreditRapidoPens).not.toHaveBeenCalled();
    expect(mockUpdateProfileById).toHaveBeenCalledWith('new-user', { referral_rewarded_at: expect.any(String) });
  });

  it('settles A→B→C→A cycles without paying anyone', async () => {
    mockFindProfileByReferralCode.mockImplementation(async (code: string) => (code === 'ABCD1234'
      ? { ...REFERRER_PROFILE, referred_by: 'CCCC1234' }
      : { ...REFERRER_PROFILE, id: 'c', email: 'c@example.com', referral_code: 'CCCC1234', referred_by: 'NEWU1234' }));
    const result = await applyReferralReward(makeUser());
    expect(result).toEqual({ success: true, rewarded: false });
    expect(mockClaimOnce).not.toHaveBeenCalled();
    expect(mockUpdateProfileById).toHaveBeenCalledWith('new-user', { referral_rewarded_at: expect.any(String) });
  });

  it('settles a missing referrer without paying', async () => {
    mockFindProfileByReferralCode.mockResolvedValue(null);
    const result = await applyReferralReward(makeUser());
    expect(result).toEqual({ success: true, rewarded: false });
    expect(mockCreditRapidoPens).not.toHaveBeenCalled();
  });

  it('pays an unverified referrer nothing', async () => {
    mockGetAuthUserById.mockResolvedValue({ id: 'referrer', email: 'referrer@example.com', name: null, emailVerified: false });
    const result = await applyReferralReward(makeUser());
    expect(result.rewarded).toBe(true);
    expect(mockCreditRapidoPens).toHaveBeenCalledTimes(1);
    expect(mockCreditRapidoPens).toHaveBeenCalledWith('new-user', expect.anything(), 5);
  });

  it('pays the referrer nothing when its identity cannot be resolved', async () => {
    mockGetAuthUserById.mockRejectedValue(new Error('users api down'));
    await applyReferralReward(makeUser());
    expect(mockCreditRapidoPens).toHaveBeenCalledTimes(1);
    expect(mockClaimOnce).not.toHaveBeenCalledWith('referral-reward-referrer:new-user');
  });
});
