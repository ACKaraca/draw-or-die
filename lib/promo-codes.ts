import { ID, Query } from 'node-appwrite';
import { TIER_DEFAULTS, isAkdenizStudentEmail } from '@/lib/pricing';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_PROMO_CODES_ID,
  APPWRITE_TABLE_PROMO_REDEMPTIONS_ID,
  AppwriteAuthUser,
  NormalizedUserProfile,
  PromoCodeRow,
  PromoRedemptionRow,
  getAdminTables,
  recordBillingEvent,
  updateProfileById,
} from '@/lib/appwrite/server';

export type PromoRewardKind = 'rapido' | 'premium' | 'discount_percent' | 'discount_amount';
export type PromoTargetScope = 'any' | 'guest' | 'registered' | 'premium' | 'edu' | 'akdeniz';

export type PromoCheckoutMode = 'premium_monthly' | 'premium_yearly' | 'rapido_pack';
export type PromoUsageMode = 'checkout' | 'redeem';

export type NormalizedPromoCode = {
  id: string;
  code: string;
  title: string;
  description: string;
  active: boolean;
  rewardKind: PromoRewardKind;
  rewardValue: number;
  rewardCurrency: string | null;
  rewardInterval: string | null;
  checkoutModes: PromoCheckoutMode[];
  targetScope: PromoTargetScope;
  maxTotalUses: number | null;
  maxUsesPerUser: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  minRapidoPurchase: number | null;
  metadata: Record<string, unknown>;
};

export type PromoValidationResult =
  | {
      valid: true;
      source: 'internal';
      promotionCodeId: string;
      promoCode: string;
      promo: NormalizedPromoCode;
      coupon: {
        id: string | null;
        name: string | null;
        duration: string | null;
        percentOff: number | null;
        amountOff: number | null;
        currency: string | null;
      } | null;
      summary: string;
    }
  | {
      valid: true;
      source: 'stripe';
      promotionCodeId: string;
      promoCode: string;
      coupon: {
        id: string | null;
        name: string | null;
        duration: string | null;
        percentOff: number | null;
        amountOff: number | null;
        currency: string | null;
      } | null;
      summary: string;
    }
  | {
      valid: false;
      code: string;
      error: string;
    };

export type PromoCheckoutAdjustment =
  | {
      kind: 'discount_percent';
      percentOff: number;
      promoCode: NormalizedPromoCode;
    }
  | {
      kind: 'discount_amount';
      amountOff: number;
      promoCode: NormalizedPromoCode;
    }
  | {
      kind: 'none';
      promoCode: NormalizedPromoCode;
    };

export type PromoRedemptionResult =
  | {
      ok: true;
      promo: NormalizedPromoCode;
      redemption: PromoRedemptionRow;
      profile: NormalizedUserProfile;
      message: string;
    }
  | {
      ok: false;
      code: string;
      error: string;
    };

function normalizeCode(code: string): string {
  return code.trim().substring(0, 64).toUpperCase();
}

function parseJsonObject(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseCsvList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function clampInteger(value: unknown, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.trunc(Number(value));
}

export function normalizePromoCodeRow(row: PromoCodeRow): NormalizedPromoCode {
  return {
    id: row.$id,
    code: normalizeCode(row.code),
    title: row.title || row.code,
    description: row.description || '',
    active: Boolean(row.active),
    rewardKind: (row.reward_kind as PromoRewardKind) || 'rapido',
    rewardValue: clampInteger(row.reward_value, 0),
    rewardCurrency: row.reward_currency ? row.reward_currency.toLowerCase() : null,
    rewardInterval: row.reward_interval || null,
    checkoutModes: parseCsvList(row.checkout_modes) as PromoCheckoutMode[],
    targetScope: (row.target_scope as PromoTargetScope) || 'any',
    maxTotalUses: Number.isFinite(row.max_total_uses) ? Number(row.max_total_uses) : null,
    maxUsesPerUser: Number.isFinite(row.max_uses_per_user) ? Number(row.max_uses_per_user) : null,
    usedCount: clampInteger(row.used_count, 0),
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    minRapidoPurchase: Number.isFinite(row.min_rapido_purchase) ? Number(row.min_rapido_purchase) : null,
    metadata: parseJsonObject(row.metadata_json),
  };
}

async function getInternalPromoByCode(code: string): Promise<NormalizedPromoCode | null> {
  const tables = getAdminTables();
  const normalizedCode = normalizeCode(code);
  const rows = await tables.listRows<PromoCodeRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_PROMO_CODES_ID,
    queries: [
      Query.equal('code', normalizedCode),
      Query.limit(1),
    ],
    total: true,
  });

  if (!rows.rows.length) return null;
  return normalizePromoCodeRow(rows.rows[0]);
}

async function getPromoUsageCounts(promo: NormalizedPromoCode, userId: string): Promise<{ totalUses: number; userUses: number }> {
  const tables = getAdminTables();
  const [total, user] = await Promise.all([
    tables.listRows<PromoRedemptionRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROMO_REDEMPTIONS_ID,
      queries: [
        Query.equal('promo_code_id', promo.id),
        Query.limit(1),
      ],
      total: true,
    }),
    tables.listRows<PromoRedemptionRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROMO_REDEMPTIONS_ID,
      queries: [
        Query.equal('promo_code_id', promo.id),
        Query.equal('user_id', userId),
        Query.limit(1),
      ],
      total: true,
    }),
  ]);

  return {
    totalUses: total.total,
    userUses: user.total,
  };
}

export function isPromoInWindow(promo: NormalizedPromoCode): boolean {
  const now = Date.now();
  if (promo.startsAt) {
    const startsAt = Date.parse(promo.startsAt);
    if (Number.isFinite(startsAt) && now < startsAt) return false;
  }

  if (promo.endsAt) {
    const endsAt = Date.parse(promo.endsAt);
    if (Number.isFinite(endsAt) && now > endsAt) return false;
  }

  return true;
}

export function matchesScope(promo: NormalizedPromoCode, user: AppwriteAuthUser, profile: NormalizedUserProfile): boolean {
  switch (promo.targetScope) {
    case 'guest':
      return !user.email;
    case 'registered':
      return Boolean(user.email);
    case 'premium':
      return profile.is_premium;
    case 'edu':
      return Boolean(profile.edu_verified);
    case 'akdeniz':
      return Boolean(profile.edu_verified && profile.edu_email && isAkdenizStudentEmail(profile.edu_email));
    default:
      return true;
  }
}

export function matchesCheckoutMode(promo: NormalizedPromoCode, mode: PromoCheckoutMode): boolean {
  if (!promo.checkoutModes.length) return true;
  return promo.checkoutModes.includes(mode);
}

function describeInternalPromo(promo: NormalizedPromoCode): string {
  switch (promo.rewardKind) {
    case 'discount_percent':
      return `%${promo.rewardValue} indirim aktif`;
    case 'discount_amount':
      return `${new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: (promo.rewardCurrency || 'try').toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(Math.max(0, promo.rewardValue) / 100)} indirim aktif`;
    case 'premium':
      return `${Math.max(1, promo.rewardValue || 30)} gün premium hakkı aktif`;
    case 'rapido':
      return `${Math.max(1, promo.rewardValue || 1)} Rapido hakkı aktif`;
    default:
      return 'Promo kodu aktif';
  }
}

export async function validatePromoForCheckout(options: {
  code: string;
  user: AppwriteAuthUser;
  profile: NormalizedUserProfile;
  mode: PromoCheckoutMode;
}): Promise<PromoValidationResult> {
  const promo = await getInternalPromoByCode(options.code);
  if (!promo) {
    return { valid: false, code: 'PROMO_NOT_FOUND', error: 'Promo kodu bulunamadı.' };
  }

  if (!promo.active || !isPromoInWindow(promo)) {
    return { valid: false, code: 'PROMO_INACTIVE', error: 'Promo kodu aktif değil veya süresi dolmuş.' };
  }

  if (!matchesScope(promo, options.user, options.profile)) {
    return { valid: false, code: 'PROMO_SCOPE_MISMATCH', error: 'Bu kod sizin hesap tipiniz için geçerli değil.' };
  }

  if (!matchesCheckoutMode(promo, options.mode)) {
    return { valid: false, code: 'PROMO_MODE_MISMATCH', error: 'Bu kod bu satın alım türünde kullanılamaz.' };
  }

  const counts = await getPromoUsageCounts(promo, options.user.id);
  if (promo.maxTotalUses !== null && counts.totalUses >= promo.maxTotalUses) {
    return { valid: false, code: 'PROMO_EXHAUSTED', error: 'Bu kodun tüm kullanım hakkı doldu.' };
  }
  if (promo.maxUsesPerUser !== null && counts.userUses >= promo.maxUsesPerUser) {
    return { valid: false, code: 'PROMO_USER_LIMIT', error: 'Bu kodu zaten maksimum kez kullandın.' };
  }

  if (promo.rewardKind !== 'discount_percent' && promo.rewardKind !== 'discount_amount') {
    return {
      valid: false,
      code: 'PROMO_REDEEM_ONLY',
      error: 'Bu kod checkout için değil, redeem ekranından kullanılmalı.',
    };
  }

  return {
    valid: true,
    source: 'internal',
    promotionCodeId: promo.id,
    promoCode: promo.code,
    promo,
    coupon: {
      id: promo.id,
      name: promo.title,
      duration: promo.rewardInterval,
      percentOff: promo.rewardKind === 'discount_percent' ? promo.rewardValue : null,
      amountOff: promo.rewardKind === 'discount_amount' ? promo.rewardValue : null,
      currency: promo.rewardCurrency,
    },
    summary: describeInternalPromo(promo),
  };
}

export async function resolveCheckoutPromo(options: {
  code: string;
  user: AppwriteAuthUser;
  profile: NormalizedUserProfile;
  mode: PromoCheckoutMode;
}): Promise<
  | {
      type: 'internal';
      promo: NormalizedPromoCode;
      percentOff?: number;
      amountOff?: number;
      currency?: string;
    }
  | {
      type: 'stripe';
      id: string;
      code: string;
    }
  | null
> {
  const internal = await validatePromoForCheckout(options);
  if (internal.valid && internal.source === 'internal') {
    return {
      type: 'internal',
      promo: internal.promo,
      percentOff: internal.coupon?.percentOff ?? undefined,
      amountOff: internal.coupon?.amountOff ?? undefined,
      currency: internal.coupon?.currency ?? undefined,
    };
  }

  return null;
}

export function buildCheckoutAdjustment(
  promo: NormalizedPromoCode,
  _baseAmountCents: number,
): PromoCheckoutAdjustment {
  if (promo.rewardKind === 'discount_percent') {
    return {
      kind: 'discount_percent',
      percentOff: Math.max(0, Math.min(100, promo.rewardValue)),
      promoCode: promo,
    };
  }

  if (promo.rewardKind === 'discount_amount') {
    return {
      kind: 'discount_amount',
      amountOff: Math.max(0, promo.rewardValue),
      promoCode: promo,
    };
  }

  return {
    kind: 'none',
    promoCode: promo,
  };
}

export async function redeemPromoCode(options: {
  code: string;
  user: AppwriteAuthUser;
  profile: NormalizedUserProfile;
}): Promise<PromoRedemptionResult> {
  const promo = await getInternalPromoByCode(options.code);
  if (!promo) {
    return { ok: false, code: 'PROMO_NOT_FOUND', error: 'Promo kodu bulunamadı.' };
  }

  if (!promo.active || !isPromoInWindow(promo)) {
    return { ok: false, code: 'PROMO_INACTIVE', error: 'Promo kodu aktif değil veya süresi dolmuş.' };
  }

  if (!matchesScope(promo, options.user, options.profile)) {
    return { ok: false, code: 'PROMO_SCOPE_MISMATCH', error: 'Bu kod bu hesap için geçerli değil.' };
  }

  if (promo.rewardKind === 'discount_percent' || promo.rewardKind === 'discount_amount') {
    return { ok: false, code: 'PROMO_CHECKOUT_ONLY', error: 'Bu kodu checkout ekranında kullanmalısın.' };
  }

  const counts = await getPromoUsageCounts(promo, options.user.id);
  if (promo.maxTotalUses !== null && counts.totalUses >= promo.maxTotalUses) {
    return { ok: false, code: 'PROMO_EXHAUSTED', error: 'Bu kodun tüm kullanım hakkı doldu.' };
  }
  if (promo.maxUsesPerUser !== null && counts.userUses >= promo.maxUsesPerUser) {
    return { ok: false, code: 'PROMO_USER_LIMIT', error: 'Bu kodu zaten maksimum kez kullandın.' };
  }

  const nowIso = new Date().toISOString();
  const tables = getAdminTables();
  const rewardValue = Math.max(0, Math.trunc(promo.rewardValue));
  let updatedProfile = options.profile;
  let rapidoDelta = 0;
  let message = 'Promo kodu uygulandı.';

  if (promo.rewardKind === 'rapido') {
    rapidoDelta = rewardValue || 1;
    const nextRapido = updatedProfile.rapido_pens + rapidoDelta;
    await updateProfileById(options.user.id, { rapido_pens: nextRapido });
    updatedProfile = {
      ...updatedProfile,
      rapido_pens: nextRapido,
    };
    message = `${rapidoDelta} Rapido eklendi.`;
  }

  if (promo.rewardKind === 'premium') {
    const premiumDays = rewardValue || 30;
    const currentBalance = updatedProfile.rapido_pens;
    const premiumBalance = Math.max(currentBalance, TIER_DEFAULTS.PREMIUM);
    rapidoDelta = Math.max(0, premiumBalance - currentBalance);
    const periodEnd = new Date(Date.now() + premiumDays * 24 * 60 * 60 * 1000).toISOString();

    await updateProfileById(options.user.id, {
      is_premium: true,
      rapido_pens: premiumBalance,
      subscription_status: 'promo',
      subscription_current_period_start: nowIso,
      subscription_current_period_end: periodEnd,
      subscription_cancel_at_period_end: false,
      premium_started_at: nowIso,
      premium_price_cents: 0,
      premium_currency: promo.rewardCurrency || 'try',
      premium_interval: promo.rewardInterval || 'promo',
      premium_promo_code: promo.code,
    });
    updatedProfile = {
      ...updatedProfile,
      is_premium: true,
      rapido_pens: premiumBalance,
      subscription_status: 'promo',
      subscription_current_period_start: nowIso,
      subscription_current_period_end: periodEnd,
      subscription_cancel_at_period_end: false,
      premium_started_at: nowIso,
      premium_price_cents: 0,
      premium_currency: promo.rewardCurrency || 'try',
      premium_interval: promo.rewardInterval || 'promo',
      premium_promo_code: promo.code,
    };
    message = `${premiumDays} gün premium eklendi.`;
  }

  const redemption = await tables.createRow<PromoRedemptionRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_PROMO_REDEMPTIONS_ID,
    rowId: ID.unique(),
    data: {
      promo_code_id: promo.id,
      promo_code: promo.code,
      user_id: options.user.id,
      reward_kind: promo.rewardKind,
      reward_value: rewardValue,
      reward_currency: promo.rewardCurrency || 'try',
      checkout_mode: 'redeem',
      note: message,
      metadata_json: JSON.stringify({
        targetScope: promo.targetScope,
        title: promo.title,
      }),
      redeemed_at: nowIso,
    },
  });

  try {
    await tables.incrementRowColumn({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROMO_CODES_ID,
      rowId: promo.id,
      column: 'used_count',
      value: 1,
      max: promo.maxTotalUses ?? undefined,
    });
  } catch {
    // Keep the redemption log even if the counter write is not available.
  }

  await recordBillingEvent({
    userId: options.user.id,
    eventType: promo.rewardKind === 'premium' ? 'promo_redemption_premium' : 'promo_redemption_rapido',
    amountCents: 0,
    currency: promo.rewardCurrency || 'try',
    rapidoDelta,
    rapidoBalanceAfter: updatedProfile.rapido_pens,
    metadata: {
      promoCodeId: promo.id,
      promoCode: promo.code,
      rewardKind: promo.rewardKind,
      rewardValue,
      redemptionId: redemption.$id,
    },
  });

  return {
    ok: true,
    promo,
    redemption,
    profile: updatedProfile,
    message,
  };
}
