import {
  getOrCreateProfile,
  getFeatureFlag,
  findProfileByReferralCode,
  updateProfileById,
  recordBillingEvent,
  type AppwriteAuthUser,
} from '@/lib/appwrite/server';
import { claimOnce, releaseClaim } from '@/lib/idempotency';
import { logServerError } from '@/lib/logger';
import { creditRapidoPens } from '@/lib/rapido-balance';

const REFERRAL_FLAG_KEY = 'referral_system';
const DEFAULT_REFERRAL_RAPIDO = 5;
// Referrals are for genuinely new accounts: old or throwaway (anonymous/unverified) accounts
// could otherwise be cycled to farm Rapido for the referrer.
const REFERRAL_LINK_MAX_ACCOUNT_AGE_DAYS = 7;
const REFERRAL_REWARD_MAX_ACCOUNT_AGE_DAYS = 30;

function isAccountYoungerThan(user: AppwriteAuthUser, days: number): boolean {
  const createdMs = user.createdAt ? Date.parse(user.createdAt) : Number.NaN;
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs <= days * 24 * 60 * 60 * 1000;
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

  // Only a verified, recently created account can trigger the reward.
  if (user.emailVerified !== true || !isAccountYoungerThan(user, REFERRAL_REWARD_MAX_ACCOUNT_AGE_DAYS)) {
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

  if (!referrer || referrer.id === userId) {
    // Referral code no longer valid - mark as rewarded to avoid retry loops
    await updateProfileById(userId, { referral_rewarded_at: new Date().toISOString() });
    return { success: true, rewarded: false };
  }

  // Parallel calls must not pay twice: only the first claim proceeds.
  const claimKey = `referral-reward:${userId}`;
  if (!(await claimOnce(claimKey))) {
    return { success: true, rewarded: false };
  }

  const rapido = config.rapido;
  let newUserRapidoAfter: number;
  let referrerRapidoAfter: number;
  try {
    await updateProfileById(userId, { referral_rewarded_at: new Date().toISOString() });
    newUserRapidoAfter = await creditRapidoPens(userId, userProfile, rapido);
    referrerRapidoAfter = await creditRapidoPens(referrer.id, referrer, rapido);
  } catch (error) {
    logServerError('referral.reward', error, { userId, referrerId: referrer.id });
    await releaseClaim(claimKey);
    return { success: false, rewarded: false, error: 'Referral ödülü verilemedi.' };
  }

  await Promise.allSettled([
    recordBillingEvent({
      userId,
      eventType: 'referral_reward_new_user',
      amountCents: 0,
      currency: 'try',
      rapidoDelta: rapido,
      rapidoBalanceAfter: newUserRapidoAfter,
      metadata: { referral_code: userProfile.referred_by, referrer_id: referrer.id },
    }),
    recordBillingEvent({
      userId: referrer.id,
      eventType: 'referral_reward_referrer',
      amountCents: 0,
      currency: 'try',
      rapidoDelta: rapido,
      rapidoBalanceAfter: referrerRapidoAfter,
      metadata: { referred_user_id: userId, referral_code: userProfile.referred_by },
    }),
  ]);

  return { success: true, rewarded: true, rapido };
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
