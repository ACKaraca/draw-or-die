import {
  registrationBonusEntitlementKey,
  type AppwriteAuthUser,
  type NormalizedUserProfile,
} from '@/lib/appwrite/server';
import { logServerError } from '@/lib/logger';
import { RAPIDO_REWARDS } from '@/lib/pricing';
import { rapidoUnitsToCents } from '@/lib/rapido-cents';
import { evaluateRewardEligibility, grantRewardOnce, type RewardGrantResult } from '@/lib/reward-policy';
import { findStripeEventRow } from '@/lib/stripe-event-ledger';

// Per-instance memo so settled users don't hit the ledger on every profile load.
const SETTLED_CACHE_MAX = 5_000;
const settledKeys = new Set<string>();

function rememberSettled(key: string): void {
  if (settledKeys.size >= SETTLED_CACHE_MAX) settledKeys.clear();
  settledKeys.add(key);
}

export function __resetRegistrationBonusCache(): void {
  settledKeys.clear();
}

export type RegistrationBonusOutcome =
  | RewardGrantResult
  | { status: 'not_applicable'; reason: 'settled' | 'legacy_profile' | 'entitlement_check_failed' | 'initial_not_recorded' };

export type RegistrationBonusResult = {
  initial: RegistrationBonusOutcome;
  verified: RegistrationBonusOutcome;
};

/**
 * Registration bonus, paid through the shared reward policy in two idempotent parts:
 * `registration-bonus-initial:<userId>` for any registered account, and `registration-bonus:<userId>`
 * once the email is verified. Only profiles created with the entitlement marker qualify, and the
 * verified part is paid only after the initial part is recorded, so legacy profiles are never paid.
 * Safe to call on every profile load: a failed grant is retried on the next one.
 */
export async function maybeGrantRegistrationBonus(
  user: AppwriteAuthUser,
  profile: NormalizedUserProfile,
): Promise<RegistrationBonusResult> {
  const initial = await grantInitial(user, profile);
  const isInitialRecorded = initial.status === 'granted' || initial.status === 'duplicate'
    || (initial.status === 'not_applicable' && initial.reason === 'settled');
  if (!isInitialRecorded) {
    return { initial, verified: { status: 'not_applicable', reason: 'initial_not_recorded' } };
  }
  return { initial, verified: await grantVerified(user, profile) };
}

async function grantInitial(user: AppwriteAuthUser, profile: NormalizedUserProfile): Promise<RegistrationBonusOutcome> {
  const eligibility = evaluateRewardEligibility({ kind: 'registration_bonus_initial', identity: user });
  if (!eligibility.eligible) return { status: 'ineligible', reason: eligibility.reason };

  const cacheKey = `initial:${user.id}`;
  if (settledKeys.has(cacheKey)) return { status: 'not_applicable', reason: 'settled' };

  try {
    if (!(await findStripeEventRow(registrationBonusEntitlementKey(user.id)))) {
      rememberSettled(cacheKey);
      rememberSettled(user.id);
      return { status: 'not_applicable', reason: 'legacy_profile' };
    }
  } catch (error) {
    logServerError('registration-bonus.entitlement', error, { userId: user.id });
    return { status: 'not_applicable', reason: 'entitlement_check_failed' };
  }

  const result = await grantRewardOnce({
    eligibility,
    idempotencyKey: `registration-bonus-initial:${user.id}`,
    sourceId: user.id,
    amountCents: rapidoUnitsToCents(RAPIDO_REWARDS.REGISTRATION_BONUS_INITIAL),
    profile,
  });
  if (result.status === 'granted' || result.status === 'duplicate') rememberSettled(cacheKey);
  return result;
}

async function grantVerified(user: AppwriteAuthUser, profile: NormalizedUserProfile): Promise<RegistrationBonusOutcome> {
  if (settledKeys.has(user.id)) return { status: 'not_applicable', reason: 'settled' };

  const eligibility = evaluateRewardEligibility({ kind: 'registration_bonus', identity: user });
  if (!eligibility.eligible) return { status: 'ineligible', reason: eligibility.reason };

  const result = await grantRewardOnce({
    eligibility,
    idempotencyKey: `registration-bonus:${user.id}`,
    sourceId: user.id,
    amountCents: rapidoUnitsToCents(RAPIDO_REWARDS.REGISTRATION_BONUS_VERIFIED),
    profile,
  });
  if (result.status === 'granted' || result.status === 'duplicate') rememberSettled(user.id);
  return result;
}
