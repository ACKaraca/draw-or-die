/** @jest-environment node */
const mockLedger = new Set<string>();
const mockClaimOnce = jest.fn();
const mockReleaseClaim = jest.fn();
const mockCreditRapidoPens = jest.fn();
const mockRecordBillingEvent = jest.fn();
const mockIncrementRowColumn = jest.fn();
const mockDecrementRowColumn = jest.fn();
const mockGetAuthUserById = jest.fn();
const mockLogInfo = jest.fn();

jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_DATABASE_ID: 'db',
  APPWRITE_TABLE_PROFILES_ID: 'profiles',
  getAdminTables: () => ({
    incrementRowColumn: (...args: unknown[]) => mockIncrementRowColumn(...args),
    decrementRowColumn: (...args: unknown[]) => mockDecrementRowColumn(...args),
  }),
  getAuthUserById: (...args: unknown[]) => mockGetAuthUserById(...args),
  recordBillingEvent: (...args: unknown[]) => mockRecordBillingEvent(...args),
}));
jest.mock('@/lib/idempotency', () => ({
  claimOnce: (...args: unknown[]) => mockClaimOnce(...args),
  releaseClaim: (...args: unknown[]) => mockReleaseClaim(...args),
}));
jest.mock('@/lib/rapido-balance', () => ({
  creditRapidoPens: (...args: unknown[]) => mockCreditRapidoPens(...args),
}));
jest.mock('@/lib/logger', () => ({
  logServerError: jest.fn(),
  logServerInfo: (...args: unknown[]) => mockLogInfo(...args),
}));

import type { AppwriteAuthUser } from '@/lib/appwrite/server';
import {
  canonicalizeEmail,
  checkReferralRelationship,
  evaluateRewardEligibility,
  grantRewardOnce,
  resolveRewardIdentity,
  type ReferralContext,
} from '@/lib/reward-policy';

const NOW = Date.parse('2026-10-13T10:00:00.000Z');
const RECENT = '2026-10-10T10:00:00.000Z';
const OLD = '2026-01-01T10:00:00.000Z';
const PROFILE = { row_id: 'row-1', rapido_pens: 10, rapido_fraction_cents: 0 };

function user(overrides: Partial<AppwriteAuthUser> = {}): AppwriteAuthUser {
  return { id: 'u1', email: 'u1@example.com', name: null, emailVerified: true, createdAt: RECENT, ...overrides };
}

function referral(overrides: Partial<ReferralContext['referrer']> = {}): ReferralContext {
  return {
    referee: { userId: 'u1', email: 'u1@example.com', referralCode: 'AAAA1111', referredBy: 'BBBB2222' },
    referrer: { userId: 'u2', email: 'u2@example.com', referralCode: 'BBBB2222', referredBy: null, ...overrides },
  };
}

describe('evaluateRewardEligibility', () => {
  const originalPaused = process.env.REWARDS_PAUSED;
  afterEach(() => {
    if (originalPaused === undefined) delete process.env.REWARDS_PAUSED;
    else process.env.REWARDS_PAUSED = originalPaused;
  });

  it.each([
    ['registration_bonus'],
    ['referral_new_user'],
    ['referral_referrer'],
    ['peer_review'],
    ['edu_verification'],
  ] as const)('denies anonymous, unverified and unresolved identities for %s', (kind) => {
    const context = { kind, referral: referral(), nowMs: NOW };
    expect(evaluateRewardEligibility({ ...context, identity: null })).toMatchObject({
      eligible: false,
      reason: 'identity_unavailable',
    });
    expect(evaluateRewardEligibility({ ...context, identity: user({ email: null }) })).toMatchObject({
      eligible: false,
      reason: 'anonymous',
    });
    expect(evaluateRewardEligibility({ ...context, identity: user({ emailVerified: false }) })).toMatchObject({
      eligible: false,
      reason: 'email_unverified',
    });
    expect(evaluateRewardEligibility({ ...context, identity: user({ emailVerified: undefined }) })).toMatchObject({
      eligible: false,
      reason: 'email_unverified',
    });
    expect(evaluateRewardEligibility({ ...context, identity: user() })).toMatchObject({ eligible: true });
  });

  it('applies the account-age window to sign-up rewards only', () => {
    expect(evaluateRewardEligibility({ kind: 'registration_bonus', identity: user({ createdAt: OLD }), nowMs: NOW }))
      .toMatchObject({ eligible: false, reason: 'account_too_old' });
    expect(evaluateRewardEligibility({ kind: 'peer_review', identity: user({ createdAt: OLD }), nowMs: NOW }))
      .toMatchObject({ eligible: true });
  });

  it('blocks self-referrals, same-mailbox referrals and A→B→A cycles', () => {
    const base = { kind: 'referral_new_user' as const, identity: user(), nowMs: NOW };
    expect(evaluateRewardEligibility({ ...base, referral: referral({ userId: 'u1' }) }))
      .toMatchObject({ eligible: false, reason: 'self_referral' });
    expect(evaluateRewardEligibility({ ...base, referral: referral({ email: 'U.1+farm@Example.com' }) }))
      .toMatchObject({ eligible: true });
    expect(evaluateRewardEligibility({ ...base, referral: referral({ email: 'U1+farm@Example.com' }) }))
      .toMatchObject({ eligible: false, reason: 'same_email_referral' });
    expect(evaluateRewardEligibility({ ...base, referral: referral({ referredBy: 'aaaa1111' }) }))
      .toMatchObject({ eligible: false, reason: 'referral_cycle' });
    expect(evaluateRewardEligibility({ ...base, referral: { ...referral(), referrer: null } }))
      .toMatchObject({ eligible: false, reason: 'referrer_missing' });
    expect(evaluateRewardEligibility({ ...base })).toMatchObject({ eligible: false, reason: 'referrer_missing' });
  });

  it('honours the kill switch', () => {
    process.env.REWARDS_PAUSED = 'true';
    expect(evaluateRewardEligibility({ kind: 'peer_review', identity: user(), nowMs: NOW }))
      .toMatchObject({ eligible: false, reason: 'rewards_paused' });
  });
});

describe('canonicalizeEmail / checkReferralRelationship', () => {
  it('folds gmail dots, plus tags and googlemail', () => {
    expect(canonicalizeEmail('A.B+x@GoogleMail.com')).toBe('ab@gmail.com');
    expect(canonicalizeEmail('a.b+x@uni.edu.tr')).toBe('a.b@uni.edu.tr');
    expect(canonicalizeEmail('not-an-email')).toBeNull();
  });

  it('flags a referee claiming its own code', () => {
    const context = referral();
    context.referee.referredBy = 'AAAA1111';
    context.referrer = { ...context.referrer!, referralCode: 'AAAA1111' };
    expect(checkReferralRelationship(context)).toBe('self_referral');
  });
});

describe('resolveRewardIdentity', () => {
  it('fails closed when the identity lookup errors', async () => {
    mockGetAuthUserById.mockRejectedValueOnce(new Error('appwrite down'));
    await expect(resolveRewardIdentity('u2')).resolves.toBeNull();
  });
});

describe('grantRewardOnce', () => {
  beforeEach(() => {
    // Legacy counter path; the journaled path is covered in lib/rapido-ledger-runtime.test.ts.
    process.env.RAPIDO_LEDGER_MODE = 'off';
    jest.clearAllMocks();
    mockLedger.clear();
    mockClaimOnce.mockImplementation(async (key: string) => {
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (mockLedger.has(key)) return false;
      mockLedger.add(key);
      return true;
    });
    mockReleaseClaim.mockImplementation(async (key: string) => {
      mockLedger.delete(key);
    });
    mockCreditRapidoPens.mockImplementation(async (_id: string, profile: { rapido_pens: number }, amount: number) =>
      profile.rapido_pens + amount);
    mockRecordBillingEvent.mockResolvedValue({});
  });

  const eligible = () => evaluateRewardEligibility({ kind: 'registration_bonus', identity: user(), nowMs: NOW });

  it('pays nothing and claims nothing for an ineligible decision', async () => {
    const decision = evaluateRewardEligibility({ kind: 'peer_review', identity: user({ emailVerified: false }) });
    const result = await grantRewardOnce({
      eligibility: decision,
      idempotencyKey: 'k',
      sourceId: 's',
      amountCents: 2000,
      profile: PROFILE,
    });
    expect(result).toEqual({ status: 'ineligible', reason: 'email_unverified' });
    expect(mockClaimOnce).not.toHaveBeenCalled();
    expect(mockCreditRapidoPens).not.toHaveBeenCalled();
  });

  it('pays once under concurrent and repeated delivery, and records a reconcilable event', async () => {
    const params = { eligibility: eligible(), idempotencyKey: 'registration-bonus:u1', sourceId: 'u1', amountCents: 2000, profile: PROFILE };
    const results = await Promise.all(Array.from({ length: 5 }, () => grantRewardOnce(params)));
    const replay = await grantRewardOnce(params);

    expect(results.filter((result) => result.status === 'granted')).toHaveLength(1);
    expect(replay.status).toBe('duplicate');
    expect(mockCreditRapidoPens).toHaveBeenCalledTimes(1);
    expect(mockCreditRapidoPens).toHaveBeenCalledWith('u1', PROFILE, 20);
    expect(mockRecordBillingEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      eventType: 'registration_bonus',
      rapidoDelta: 20,
      metadata: expect.objectContaining({ idempotency_key: 'registration-bonus:u1', source_id: 'u1' }),
    }));
    expect(mockLogInfo).toHaveBeenCalledWith('reward.granted', expect.objectContaining({
      idempotencyKey: 'registration-bonus:u1',
      sourceId: 'u1',
      kind: 'registration_bonus',
    }));
  });

  it('fails closed when the ledger is unavailable', async () => {
    mockClaimOnce.mockRejectedValueOnce(new Error('ledger down'));
    const result = await grantRewardOnce({ eligibility: eligible(), idempotencyKey: 'k', sourceId: 's', amountCents: 500, profile: PROFILE });
    expect(result.status).toBe('failed');
    expect(mockCreditRapidoPens).not.toHaveBeenCalled();
  });

  it('releases the claim when crediting fails so a retry can pay once', async () => {
    mockCreditRapidoPens.mockRejectedValueOnce(new Error('appwrite down'));
    const params = { eligibility: eligible(), idempotencyKey: 'k', sourceId: 's', amountCents: 500, profile: PROFILE };
    expect((await grantRewardOnce(params)).status).toBe('failed');
    expect(mockReleaseClaim).toHaveBeenCalledWith('k');
    expect((await grantRewardOnce(params)).status).toBe('granted');
  });

  it('credits fractional rewards atomically and carries into a whole Rapido on overflow', async () => {
    const decision = evaluateRewardEligibility({ kind: 'peer_review', identity: user() });
    mockIncrementRowColumn.mockResolvedValueOnce({ rapido_pens: 10, rapido_fraction_cents: 25 });
    const simple = await grantRewardOnce({ eligibility: decision, idempotencyKey: 'a', sourceId: 'r1', amountCents: 25, profile: PROFILE });
    expect(simple).toMatchObject({ status: 'granted', balanceCents: 1025 });
    expect(mockIncrementRowColumn).toHaveBeenCalledWith(expect.objectContaining({ column: 'rapido_fraction_cents', value: 25, max: 99 }));

    mockIncrementRowColumn
      .mockRejectedValueOnce(new Error('limit exceeded'))
      .mockResolvedValueOnce({ rapido_pens: 11, rapido_fraction_cents: 5 });
    mockDecrementRowColumn.mockResolvedValueOnce({ rapido_pens: 10, rapido_fraction_cents: 5 });
    const carried = await grantRewardOnce({
      eligibility: decision,
      idempotencyKey: 'b',
      sourceId: 'r2',
      amountCents: 25,
      profile: { ...PROFILE, rapido_fraction_cents: 80 },
    });
    expect(carried).toMatchObject({ status: 'granted', balanceCents: 1105 });
    expect(mockDecrementRowColumn).toHaveBeenCalledWith(expect.objectContaining({ column: 'rapido_fraction_cents', value: 75, min: 0 }));
    expect(mockIncrementRowColumn).toHaveBeenLastCalledWith(expect.objectContaining({ column: 'rapido_pens', value: 1 }));
  });
});
