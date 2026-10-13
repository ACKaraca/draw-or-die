import {
  getOrCreateProfile,
  getFeatureFlag,
  findProfileByReferralCode,
  updateProfileById,
  type AppwriteAuthUser,
  type NormalizedUserProfile,
} from '@/lib/appwrite/server';
import { logServerError, logServerInfo } from '@/lib/logger';
import { rapidoUnitsToCents } from '@/lib/rapido-cents';
import {
  checkReferralRelationship,
  evaluateRewardEligibility,
  grantRewardOnce,
  resolveRewardIdentity,
  type ReferralContext,
  type ReferralParty,
  type RewardIneligibleReason,
} from '@/lib/reward-policy';

const REFERRAL_FLAG_KEY = 'referral_system';
const DEFAULT_REFERRAL_RAPIDO = 5;
// Referrals are for genuinely new accounts: old or throwaway (anonymous/unverified) accounts
// could otherwise be cycled to farm Rapido for the referrer.
const REFERRAL_LINK_MAX_ACCOUNT_AGE_DAYS = 7;

// Relationship and age problems never resolve themselves, so the referral is settled without payout.
const TERMINAL_REFERRAL_REASONS: ReadonlySet<RewardIneligibleReason> = new Set<RewardIneligibleReason>([
  'self_referral',
  'same_email_referral',
  'referral_cycle',
  'referrer_missing',
  'account_too_old',
]);

function isAccountYoungerThan(user: AppwriteAuthUser, days: number): boolean {
  const createdMs = user.createdAt ? Date.parse(user.createdAt) : Number.NaN;
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs <= days * 24 * 60 * 60 * 1000;
}

function toReferralParty(profile: NormalizedUserProfile, email: string | null): ReferralParty {
  return {
    userId: profile.id,
    email: email ?? profile.email,
    referralCode: profile.referral_code,
    referredBy: profile.referred_by,
  };
}

export async function getReferralConfig(): Promise<{ enabled: boolean; rapido: number }> {
  try {
    const flag = await getFeatureFlag(REFERRAL_FLAG_KEY);
    // Keep referral active by default unless explicitly disabled via feature flag.
    if (!flag) return { enabled: true, rapido: DEFAULT_REFERRAL_RAPIDO };

    let rapido = DEFAULT_REFERRAL_RAPIDO;
    if (flag.value_json) {
      try {
        const parsed = JSON.parse(flag.value_json) as { referral_rapido?: number };
        if (typeof parsed.referral_rapido === 'number' && parsed.referral_rapido > 0) {
          rapido = Math.trunc(parsed.referral_rapido);
        }
      } catch {
        // Keep default
      }
    }

    return { enabled: flag.enabled, rapido };
  } catch {
    return { enabled: true, rapido: DEFAULT_REFERRAL_RAPIDO };
  }
}

export async function linkReferralToUser(
  user: AppwriteAuthUser,
  referralCode: string,
): Promise<{ success: boolean; error?: string }> {
  const userId = user.id;
  if (!user.email) {
    return { success: false, error: 'Referral kodu için e-posta ile kayıtlı bir hesap gerekli.' };
  }
  if (!isAccountYoungerThan(user, REFERRAL_LINK_MAX_ACCOUNT_AGE_DAYS)) {
    return { success: false, error: 'Referral kodu yalnızca yeni hesaplarda kullanılabilir.' };
  }

  const normalized = referralCode.trim().toUpperCase();
  if (!normalized || normalized.length < 4 || normalized.length > 16) {
    return { success: false, error: 'Geçersiz referral kodu.' };
  }

  // Find the referrer
  let referrer;
  try {
    referrer = await findProfileByReferralCode(normalized);
  } catch {
    return { success: false, error: 'Referral kodu kontrol edilemedi.' };
  }

  if (!referrer) {
    return { success: false, error: 'Referral kodu bulunamadı.' };
  }

  if (referrer.id === userId) {
    return { success: false, error: 'Kendi referral kodunu kullanamazsın.' };
  }

  // Check user's current profile
  let userProfile;
  try {
    userProfile = await getOrCreateProfile({ id: userId, email: null, name: null });
  } catch {
    return { success: false, error: 'Profil bulunamadı.' };
  }

  if (userProfile.referred_by) {
    return { success: false, error: 'Zaten bir referral kodu bağlı.' };
  }

  if (userProfile.referral_rewarded_at) {
    return { success: false, error: 'Referral ödülü zaten verildi.' };
  }

  const relationshipIssue = checkReferralRelationship({
    referee: { ...toReferralParty(userProfile, user.email), referredBy: normalized },
    referrer: toReferralParty(referrer, referrer.email),
  });
  if (relationshipIssue) {
    logServerInfo('referral.link_rejected', { userId, referrerId: referrer.id, reason: relationshipIssue });
    return { success: false, error: 'Bu referral kodu bu hesap için kullanılamaz.' };
  }

  await updateProfileById(userId, { referred_by: normalized });
  return { success: true };
}

export async function applyReferralReward(
  user: AppwriteAuthUser,
): Promise<{ success: boolean; rewarded: boolean; rapido?: number; error?: string }> {
  const userId = user.id;
  const config = await getReferralConfig();
  if (!config.enabled) {
    return { success: true, rewarded: false };
  }

  // Cheap pre-check before any lookup; the authoritative decision is made by the reward policy.
  if (user.emailVerified !== true || !user.email) {
    return { success: true, rewarded: false };
  }

  let userProfile;
  try {
    userProfile = await getOrCreateProfile(user);
  } catch {
    return { success: false, rewarded: false, error: 'Profil bulunamadı.' };
  }

  if (userProfile.referral_rewarded_at || !userProfile.referred_by) {
    return { success: true, rewarded: false };
  }

  let referrer;
  try {
    referrer = await findProfileByReferralCode(userProfile.referred_by);
  } catch {
    return { success: false, rewarded: false, error: 'Referrer bulunamadı.' };
  }

  const referral: ReferralContext = {
    referee: toReferralParty(userProfile, user.email),
    referrer: referrer ? toReferralParty(referrer, referrer.email) : null,
  };
  const refereeDecision = evaluateRewardEligibility({ kind: 'referral_new_user', identity: user, referral });

  if (!refereeDecision.eligible || !referrer) {
    if (!refereeDecision.eligible && TERMINAL_REFERRAL_REASONS.has(refereeDecision.reason)) {
      // Settle the referral so it is never retried, and keep the reason observable.
      await updateProfileById(userId, { referral_rewarded_at: new Date().toISOString() });
      logServerInfo('reward.denied', {
        kind: 'referral_new_user',
        userId,
        sourceId: userId,
        reason: refereeDecision.reason,
      });
    }
    return { success: true, rewarded: false };
  }

  const amountCents = rapidoUnitsToCents(config.rapido);
  // The referee's grant is the source claim: concurrent calls race on this single ledger key.
  const refereeGrant = await grantRewardOnce({
    eligibility: refereeDecision,
    idempotencyKey: `referral-reward:${userId}`,
    sourceId: userId,
    amountCents,
    profile: userProfile,
    metadata: { referral_code: userProfile.referred_by, referrer_id: referrer.id },
  });

  if (refereeGrant.status === 'failed') {
    return { success: false, rewarded: false, error: 'Referral ödülü verilemedi.' };
  }
  if (refereeGrant.status !== 'granted') {
    return { success: true, rewarded: false };
  }

  try {
    await updateProfileById(userId, { referral_rewarded_at: new Date().toISOString() });
  } catch (error) {
    // The ledger key already blocks a second payout; this marker only short-circuits retries.
    logServerError('referral.mark_rewarded', error, { userId });
  }

  // The referrer is paid only for its own verified identity; a lookup failure pays nothing.
  const referrerIdentity = await resolveRewardIdentity(referrer.id);
  const referrerDecision = evaluateRewardEligibility({
    kind: 'referral_referrer',
    identity: referrerIdentity,
    referral,
  });
  await grantRewardOnce({
    eligibility: referrerDecision,
    idempotencyKey: `referral-reward-referrer:${userId}`,
    sourceId: userId,
    amountCents,
    profile: referrer,
    metadata: { referred_user_id: userId, referral_code: userProfile.referred_by },
  });

  return { success: true, rewarded: true, rapido: config.rapido };
}

// Verify referral code exists (for validation before signup completes)
export async function validateReferralCode(code: string): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  if (!normalized || normalized.length < 4 || normalized.length > 16) return false;
  try {
    const referrer = await findProfileByReferralCode(normalized);
    return referrer !== null;
  } catch {
    return false;
  }
}
