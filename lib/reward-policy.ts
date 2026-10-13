import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_PROFILES_ID,
  getAdminTables,
  getAuthUserById,
  recordBillingEvent,
  type AppwriteAuthUser,
  type NormalizedUserProfile,
  type UserProfileRow,
} from '@/lib/appwrite/server';
import { claimOnce, releaseClaim } from '@/lib/idempotency';
import { logServerError, logServerInfo } from '@/lib/logger';
import { creditRapidoPens } from '@/lib/rapido-balance';
import { RAPIDO_PRECISION_SCALE, toRapidoCents } from '@/lib/rapido-cents';

/**
 * Single server-owned policy for every non-purchased value grant (registration bonus, referral,
 * peer review, edu verification). Every reward route must call `evaluateRewardEligibility` and
 * pay only through `grantRewardOnce`, so verification, loop and idempotency rules cannot drift.
 */

export type RewardKind =
  | 'registration_bonus'
  | 'referral_new_user'
  | 'referral_referrer'
  | 'peer_review'
  | 'edu_verification';

export type RewardIneligibleReason =
  | 'identity_unavailable'
  | 'anonymous'
  | 'email_unverified'
  | 'account_too_old'
  | 'self_referral'
  | 'same_email_referral'
  | 'referral_cycle'
  | 'referrer_missing'
  | 'rewards_paused';

export type RewardEligibility =
  | { eligible: true; kind: RewardKind; userId: string }
  | { eligible: false; kind: RewardKind; userId: string | null; reason: RewardIneligibleReason };

export type ReferralParty = {
  userId: string;
  email: string | null;
  referralCode: string | null;
  referredBy: string | null;
};

export type ReferralContext = {
  referee: ReferralParty;
  referrer: ReferralParty | null;
};

export type RewardEligibilityInput = {
  kind: RewardKind;
  /** `null` means the identity could not be resolved: always ineligible (fail closed). */
  identity: AppwriteAuthUser | null;
  referral?: ReferralContext;
  nowMs?: number;
};

type RewardRule = {
  /** Reward only for accounts younger than this many days; `null` means no age limit. */
  maxAccountAgeDays: number | null;
  billingEventType: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const REWARD_RULES: Record<RewardKind, RewardRule> = {
  registration_bonus: { maxAccountAgeDays: 30, billingEventType: 'registration_bonus' },
  referral_new_user: { maxAccountAgeDays: 30, billingEventType: 'referral_reward_new_user' },
  referral_referrer: { maxAccountAgeDays: null, billingEventType: 'referral_reward_referrer' },
  peer_review: { maxAccountAgeDays: null, billingEventType: 'peer_review_reward' },
  edu_verification: { maxAccountAgeDays: null, billingEventType: 'edu_verification' },
};

/** Kill switch: `REWARDS_PAUSED=true` stops every grant without touching existing balances. */
export function areRewardsPaused(): boolean {
  return (process.env.REWARDS_PAUSED ?? '').trim().toLowerCase() === 'true';
}

/**
 * Canonical mailbox for loop detection: case-folded, `+tag` removed, and dots ignored for Gmail,
 * so `a.b+x@gmail.com` and `ab@googlemail.com` count as the same person.
 */
export function canonicalizeEmail(email: string | null | undefined): string | null {
  const trimmed = (email ?? '').trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return null;
  let local = trimmed.slice(0, at).split('+')[0];
  let domain = trimmed.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return local ? `${local}@${domain}` : null;
}

function normalizeCode(code: string | null | undefined): string | null {
  const normalized = (code ?? '').trim().toUpperCase();
  return normalized || null;
}

/** Relationship checks shared by referral linking (pre-verification) and referral payout. */
export function checkReferralRelationship(context: ReferralContext): RewardIneligibleReason | null {
  const { referee, referrer } = context;
  if (!referrer) return 'referrer_missing';
  if (referrer.userId === referee.userId) return 'self_referral';

  const refereeEmail = canonicalizeEmail(referee.email);
  if (refereeEmail && refereeEmail === canonicalizeEmail(referrer.email)) return 'same_email_referral';

  // A→B→A: the referrer was itself referred by the referee's code.
  const refereeCode = normalizeCode(referee.referralCode);
  if (refereeCode && normalizeCode(referrer.referredBy) === refereeCode) return 'referral_cycle';
  // The referee claims a code that is its own.
  if (refereeCode && normalizeCode(referee.referredBy) === refereeCode) return 'self_referral';
  return null;
}

function isAccountYoungerThan(createdAt: string | null | undefined, days: number, nowMs: number): boolean {
  const createdMs = createdAt ? Date.parse(createdAt) : Number.NaN;
  if (!Number.isFinite(createdMs)) return false;
  return nowMs - createdMs <= days * DAY_MS;
}

export function evaluateRewardEligibility(input: RewardEligibilityInput): RewardEligibility {
  const { kind, identity } = input;
  const nowMs = input.nowMs ?? Date.now();
  const deny = (reason: RewardIneligibleReason): RewardEligibility => ({
    eligible: false,
    kind,
    userId: identity?.id ?? null,
    reason,
  });

  if (areRewardsPaused()) return deny('rewards_paused');
  if (!identity || !identity.id) return deny('identity_unavailable');
  if (!identity.email || !identity.email.trim()) return deny('anonymous');
  if (identity.emailVerified !== true) return deny('email_unverified');

  const { maxAccountAgeDays } = REWARD_RULES[kind];
  if (maxAccountAgeDays !== null && !isAccountYoungerThan(identity.createdAt, maxAccountAgeDays, nowMs)) {
    return deny('account_too_old');
  }

  if (kind === 'referral_new_user' || kind === 'referral_referrer') {
    if (!input.referral) return deny('referrer_missing');
    const relationshipIssue = checkReferralRelationship(input.referral);
    if (relationshipIssue) return deny(relationshipIssue);
  }

  return { eligible: true, kind, userId: identity.id };
}

/** Resolves another user's auth identity (e.g. the referrer). Lookup errors yield `null` → ineligible. */
export async function resolveRewardIdentity(userId: string): Promise<AppwriteAuthUser | null> {
  try {
    return await getAuthUserById(userId);
  } catch (error) {
    logServerError('reward.identity_lookup', error, { userId });
    return null;
  }
}

export type RewardGrantResult =
  | { status: 'granted'; amountCents: number; balanceCents: number; idempotencyKey: string }
  | { status: 'duplicate'; idempotencyKey: string }
  | { status: 'ineligible'; reason: RewardIneligibleReason }
  | { status: 'failed'; idempotencyKey: string };

export type GrantRewardParams = {
  eligibility: RewardEligibility;
  /** Ledger key, unique per (reward kind, beneficiary, source action). */
  idempotencyKey: string;
  /** Id of the source action (review id, referee id, …) so every grant is reconcilable. */
  sourceId: string;
  amountCents: number;
  profile: Pick<NormalizedUserProfile, 'row_id' | 'rapido_pens' | 'rapido_fraction_cents'>;
  metadata?: Record<string, unknown>;
};

/**
 * Pays `amountCents` at most once per `idempotencyKey`, only for an eligible decision. The balance
 * write is isolated in `creditRewardCents` so it can be swapped for the Rapido ledger later.
 */
export async function grantRewardOnce(params: GrantRewardParams): Promise<RewardGrantResult> {
  const { eligibility, idempotencyKey, sourceId } = params;
  const amountCents = Math.max(0, Math.round(params.amountCents));
  const logBase = { kind: eligibility.kind, userId: eligibility.userId, sourceId, idempotencyKey, amountCents };

  if (!eligibility.eligible) {
    logServerInfo('reward.denied', { ...logBase, reason: eligibility.reason });
    return { status: 'ineligible', reason: eligibility.reason };
  }
  if (areRewardsPaused()) {
    logServerInfo('reward.denied', { ...logBase, reason: 'rewards_paused' });
    return { status: 'ineligible', reason: 'rewards_paused' };
  }

  const userId = eligibility.userId;
  let claimed: boolean;
  try {
    claimed = await claimOnce(idempotencyKey);
  } catch (error) {
    logServerError('reward.claim', error, logBase);
    return { status: 'failed', idempotencyKey };
  }
  if (!claimed) {
    logServerInfo('reward.duplicate', logBase);
    return { status: 'duplicate', idempotencyKey };
  }

  let balanceCents: number;
  try {
    balanceCents = await creditRewardCents(userId, params.profile, amountCents);
  } catch (error) {
    logServerError('reward.credit', error, logBase);
    await releaseClaim(idempotencyKey);
    return { status: 'failed', idempotencyKey };
  }

  logServerInfo('reward.granted', { ...logBase, balanceCents });
  try {
    await recordBillingEvent({
      userId,
      eventType: REWARD_RULES[eligibility.kind].billingEventType,
      amountCents: 0,
      currency: 'try',
      rapidoDelta: Math.trunc(amountCents / RAPIDO_PRECISION_SCALE),
      rapidoBalanceAfter: Math.trunc(balanceCents / RAPIDO_PRECISION_SCALE),
      metadata: {
        ...params.metadata,
        reward_kind: eligibility.kind,
        source_id: sourceId,
        idempotency_key: idempotencyKey,
        rapido_delta_cents: amountCents,
      },
    });
  } catch (error) {
    // The grant itself is durable (ledger + balance); the structured log above keeps it reconcilable.
    logServerError('reward.audit_record', error, logBase);
  }

  return { status: 'granted', amountCents, balanceCents, idempotencyKey };
}

async function creditRewardCents(
  userId: string,
  profile: GrantRewardParams['profile'],
  amountCents: number,
): Promise<number> {
  const wholeRapido = Math.trunc(amountCents / RAPIDO_PRECISION_SCALE);
  const fractionCents = amountCents % RAPIDO_PRECISION_SCALE;
  let pens = profile.rapido_pens;
  let fraction = profile.rapido_fraction_cents;

  if (wholeRapido > 0) {
    pens = await creditRapidoPens(userId, profile, wholeRapido);
  }
  if (fractionCents > 0) {
    const updated = await creditFractionCents(userId, profile.row_id, fractionCents);
    pens = Math.max(pens, updated.pens);
    fraction = updated.fraction;
  }
  return toRapidoCents(pens, fraction);
}

/**
 * Adds sub-Rapido cents atomically: increment the fraction column bounded by its max (99); when
 * that would overflow, atomically take the carry out of the fraction (bounded by 0) and add one
 * whole Rapido. Retries cover a parallel write moving the fraction between the two attempts.
 */
async function creditFractionCents(
  userId: string,
  rowId: string | undefined,
  fractionCents: number,
): Promise<{ pens: number; fraction: number }> {
  if (!rowId) {
    throw new Error(`Profile row id required for fractional reward: ${userId}`);
  }
  const tables = getAdminTables();
  const target = { databaseId: APPWRITE_DATABASE_ID, tableId: APPWRITE_TABLE_PROFILES_ID, rowId };
  const read = (row: UserProfileRow) => ({
    pens: Number(row.rapido_pens) || 0,
    fraction: Number(row.rapido_fraction_cents) || 0,
  });

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const row = await tables.incrementRowColumn<UserProfileRow>({
        ...target,
        column: 'rapido_fraction_cents',
        value: fractionCents,
        max: RAPIDO_PRECISION_SCALE - 1,
      });
      return read(row);
    } catch (error) {
      lastError = error;
    }
    try {
      await tables.decrementRowColumn<UserProfileRow>({
        ...target,
        column: 'rapido_fraction_cents',
        value: RAPIDO_PRECISION_SCALE - fractionCents,
        min: 0,
      });
      const row = await tables.incrementRowColumn<UserProfileRow>({ ...target, column: 'rapido_pens', value: 1 });
      return read(row);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Fractional reward credit failed');
}
