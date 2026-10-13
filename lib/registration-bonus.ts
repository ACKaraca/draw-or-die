import { Query } from 'node-appwrite';

import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_PROFILES_ID,
  getAdminTables,
  getProfileRowForUser,
  type AppwriteAuthUser,
  type NormalizedUserProfile,
  type UserProfileRow,
} from '@/lib/appwrite/server';
import { logServerError } from '@/lib/logger';
import { rapidoUnitsToCents } from '@/lib/rapido-cents';
import { evaluateRewardEligibility, grantRewardOnce, type RewardGrantResult } from '@/lib/reward-policy';

export const EARLY_REGISTRATION_BONUS_LIMIT = 100;
export const EARLY_REGISTRATION_BONUS_RAPIDO = 20;
// New cohort rollout: only registrations after this timestamp are counted.
const EARLY_REGISTRATION_BONUS_START_AT =
  process.env.APPWRITE_EARLY_REGISTRATION_BONUS_START_AT_V2 ?? '2026-04-12T00:00:00.000Z';

/**
 * Profiles created before this instant were funded by the legacy create-time bonus, so they are
 * never paid again. Unset → the bonus is paused (fail closed) until the owner sets it at deploy.
 */
function getActivationAtMs(): number | null {
  const raw = (process.env.REGISTRATION_BONUS_ACTIVATION_AT ?? '').trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

// Per-instance memo so settled users don't hit the cohort query + ledger on every profile load.
const SETTLED_CACHE_MAX = 5_000;
const settledUserIds = new Set<string>();

function rememberSettled(userId: string): void {
  if (settledUserIds.size >= SETTLED_CACHE_MAX) settledUserIds.clear();
  settledUserIds.add(userId);
}

export function __resetRegistrationBonusCache(): void {
  settledUserIds.clear();
}

export type RegistrationBonusOutcome =
  | RewardGrantResult
  | {
      status: 'not_applicable';
      reason: 'paused' | 'settled' | 'legacy_profile' | 'outside_cohort' | 'profile_missing' | 'cohort_check_failed';
    };

/**
 * Early-registration bonus, paid through the shared reward policy once the account's email is
 * verified. Idempotent per user (`registration-bonus:<userId>`), so it is safe on every profile load.
 */
export async function maybeGrantRegistrationBonus(
  user: AppwriteAuthUser,
  profile: NormalizedUserProfile,
): Promise<RegistrationBonusOutcome> {
  const eligibility = evaluateRewardEligibility({ kind: 'registration_bonus', identity: user });
  if (!eligibility.eligible) {
    return { status: 'ineligible', reason: eligibility.reason };
  }

  if (settledUserIds.has(user.id)) {
    return { status: 'not_applicable', reason: 'settled' };
  }

  const activationAtMs = getActivationAtMs();
  if (activationAtMs === null) {
    return { status: 'not_applicable', reason: 'paused' };
  }

  let row: UserProfileRow | null;
  try {
    row = await getProfileRowForUser(user.id);
  } catch (error) {
    logServerError('registration-bonus.profile', error, { userId: user.id });
    return { status: 'not_applicable', reason: 'profile_missing' };
  }
  if (!row) return { status: 'not_applicable', reason: 'profile_missing' };

  const profileCreatedMs = Date.parse(row.$createdAt);
  if (!Number.isFinite(profileCreatedMs) || profileCreatedMs < activationAtMs) {
    rememberSettled(user.id);
    return { status: 'not_applicable', reason: 'legacy_profile' };
  }

  let earlierRegistrations: number;
  try {
    const result = await getAdminTables().listRows<UserProfileRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROFILES_ID,
      queries: [
        Query.notEqual('email', ''),
        Query.createdAfter(EARLY_REGISTRATION_BONUS_START_AT),
        Query.createdBefore(row.$createdAt),
        Query.limit(1),
      ],
      total: true,
    });
    earlierRegistrations = result.total;
  } catch (error) {
    logServerError('registration-bonus.cohort', error, { userId: user.id });
    return { status: 'not_applicable', reason: 'cohort_check_failed' };
  }

  if (!Number.isFinite(earlierRegistrations) || earlierRegistrations >= EARLY_REGISTRATION_BONUS_LIMIT) {
    rememberSettled(user.id);
    return { status: 'not_applicable', reason: 'outside_cohort' };
  }

  const result = await grantRewardOnce({
    eligibility,
    idempotencyKey: `registration-bonus:${user.id}`,
    sourceId: user.id,
    amountCents: rapidoUnitsToCents(EARLY_REGISTRATION_BONUS_RAPIDO),
    profile,
    metadata: { cohort_position: earlierRegistrations + 1 },
  });
  if (result.status === 'granted' || result.status === 'duplicate') {
    rememberSettled(user.id);
  }
  return result;
}
