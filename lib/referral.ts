import {
  getAdminTables,
  getFeatureFlag,
  findProfileByReferralCode,
  updateProfileById,
  recordBillingEvent,
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_PROFILES_ID,
  type UserProfileRow,
} from '@/lib/appwrite/server';

const REFERRAL_FLAG_KEY = 'referral_system';
const DEFAULT_REFERRAL_RAPIDO = 5;

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
  userId: string,
  referralCode: string,
): Promise<{ success: boolean; error?: string }> {
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
  const tables = getAdminTables();
  let userRow: UserProfileRow;
  try {
    userRow = await tables.getRow<UserProfileRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROFILES_ID,
      rowId: userId,
    });
  } catch {
    return { success: false, error: 'Profil bulunamadı.' };
  }

  if (userRow.referred_by) {
    return { success: false, error: 'Zaten bir referral kodu bağlı.' };
  }

  if (userRow.referral_rewarded_at) {
    return { success: false, error: 'Referral ödülü zaten verildi.' };
  }

  await updateProfileById(userId, { referred_by: normalized });
  return { success: true };
}

export async function applyReferralReward(
  userId: string,
): Promise<{ success: boolean; rewarded: boolean; rapido?: number; error?: string }> {
  const config = await getReferralConfig();
  if (!config.enabled) {
    return { success: true, rewarded: false };
  }

  const tables = getAdminTables();

  let userRow: UserProfileRow;
  try {
    userRow = await tables.getRow<UserProfileRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROFILES_ID,
      rowId: userId,
    });
  } catch {
    return { success: false, rewarded: false, error: 'Profil bulunamadı.' };
  }

  // Already rewarded
  if (userRow.referral_rewarded_at) {
    return { success: true, rewarded: false };
  }

  // No referral linked
  if (!userRow.referred_by) {
    return { success: true, rewarded: false };
  }

  // Find referrer
  let referrer;
  try {
    referrer = await findProfileByReferralCode(userRow.referred_by);
  } catch {
    return { success: false, rewarded: false, error: 'Referrer bulunamadı.' };
  }

  if (!referrer) {
    // Referral code no longer valid - mark as rewarded to avoid retry loops
    await updateProfileById(userId, { referral_rewarded_at: new Date().toISOString() });
    return { success: true, rewarded: false };
  }

  const rapido = config.rapido;
  const now = new Date().toISOString();

  // Award to new user
  const newUserRapidoAfter = (Number.isFinite(userRow.rapido_pens) ? Number(userRow.rapido_pens) : 0) + rapido;
  await updateProfileById(userId, {
    rapido_pens: newUserRapidoAfter,
    referral_rewarded_at: now,
  });

  // Award to referrer
  const referrerRapidoAfter = referrer.rapido_pens + rapido;
  await updateProfileById(referrer.id, {
    rapido_pens: referrerRapidoAfter,
  });

  // Log billing events
  await Promise.allSettled([
    recordBillingEvent({
      userId,
      eventType: 'referral_reward_new_user',
      amountCents: 0,
      currency: 'try',
      rapidoDelta: rapido,
      rapidoBalanceAfter: newUserRapidoAfter,
      metadata: { referral_code: userRow.referred_by, referrer_id: referrer.id },
    }),
    recordBillingEvent({
      userId: referrer.id,
      eventType: 'referral_reward_referrer',
      amountCents: 0,
      currency: 'try',
      rapidoDelta: rapido,
      rapidoBalanceAfter: referrerRapidoAfter,
      metadata: { referred_user_id: userId, referral_code: userRow.referred_by },
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
