import { randomBytes } from 'crypto';
import { Account, Client, ID, Query, Storage, TablesDB } from 'node-appwrite';
import type { Models } from 'node-appwrite';
import type { NextRequest } from 'next/server';
import { isAppwriteConflict, isAppwriteNotFound } from '@/lib/appwrite/error-utils';
import { normalizeLanguage, type SupportedLanguage } from '@/lib/i18n';
import { TIER_DEFAULTS } from '@/lib/pricing';

export const APPWRITE_SERVER_ENDPOINT = process.env.APPWRITE_ENDPOINT ?? 'https://fra.cloud.appwrite.io/v1';
export const APPWRITE_SERVER_PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? 'draw-or-die';
export const APPWRITE_SERVER_API_KEY = process.env.APPWRITE_API_KEY ?? '';

export const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID ?? 'draw_or_die';
export const APPWRITE_TABLE_PROFILES_ID = process.env.APPWRITE_TABLE_PROFILES_ID ?? 'profiles';
export const APPWRITE_TABLE_GALLERY_ID = process.env.APPWRITE_TABLE_GALLERY_ID ?? 'gallery_submissions';
export const APPWRITE_TABLE_STRIPE_EVENTS_ID = process.env.APPWRITE_TABLE_STRIPE_EVENTS_ID ?? 'stripe_events';
export const APPWRITE_TABLE_BILLING_EVENTS_ID = process.env.APPWRITE_TABLE_BILLING_EVENTS_ID ?? 'billing_events';
export const APPWRITE_TABLE_ANALYSIS_HISTORY_ID = process.env.APPWRITE_TABLE_ANALYSIS_HISTORY_ID ?? 'analysis_history';
export const APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID = process.env.APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID ?? 'analysis_file_cache';
export const APPWRITE_TABLE_MEMORY_SNIPPETS_ID = process.env.APPWRITE_TABLE_MEMORY_SNIPPETS_ID ?? 'memory_snippets';
export const APPWRITE_TABLE_MENTOR_CHATS_ID = process.env.APPWRITE_TABLE_MENTOR_CHATS_ID ?? 'mentor_chats';
export const APPWRITE_TABLE_MENTOR_MESSAGES_ID = process.env.APPWRITE_TABLE_MENTOR_MESSAGES_ID ?? 'mentor_messages';
export const APPWRITE_TABLE_FEEDBACK_ID = process.env.APPWRITE_TABLE_FEEDBACK_ID ?? 'feedback_entries';
export const APPWRITE_TABLE_PROMO_CODES_ID = process.env.APPWRITE_TABLE_PROMO_CODES_ID ?? 'promo_codes';
export const APPWRITE_TABLE_PROMO_REDEMPTIONS_ID = process.env.APPWRITE_TABLE_PROMO_REDEMPTIONS_ID ?? 'promo_redemptions';
export const APPWRITE_TABLE_FEATURE_FLAGS_ID = process.env.APPWRITE_TABLE_FEATURE_FLAGS_ID ?? 'feature_flags';
export const APPWRITE_BUCKET_GALLERY_ID = process.env.APPWRITE_BUCKET_GALLERY_ID ?? 'gallery';

const EARLY_REGISTRATION_BONUS_LIMIT = 30;
const EARLY_REGISTRATION_BONUS_RAPIDO = 20;
const EARLY_REGISTRATION_BONUS_START_AT = process.env.APPWRITE_EARLY_REGISTRATION_BONUS_START_AT ?? '2026-04-07T00:00:00.000Z';

export type AppwriteAuthUser = {
  id: string;
  email: string | null;
  name: string | null;
};

function createBaseClient(): Client {
  return new Client().setEndpoint(APPWRITE_SERVER_ENDPOINT).setProject(APPWRITE_SERVER_PROJECT_ID);
}

export function createAdminClient(): Client {
  if (!APPWRITE_SERVER_API_KEY) {
    throw new Error('APPWRITE_API_KEY eksik. Server-side Appwrite işlemleri için gerekli.');
  }
  return createBaseClient().setKey(APPWRITE_SERVER_API_KEY);
}

export function createJwtClient(jwt: string): Client {
  return createBaseClient().setJWT(jwt);
}

export function getAdminTables(): TablesDB {
  return new TablesDB(createAdminClient());
}

export function getAdminStorage(): Storage {
  return new Storage(createAdminClient());
}

export async function getUserFromJwt(jwt: string): Promise<AppwriteAuthUser | null> {
  try {
    const account = new Account(createJwtClient(jwt));
    const user = await account.get();
    return {
      id: user.$id,
      email: user.email ?? null,
      name: user.name ?? null,
    };
  } catch {
    return null;
  }
}

export async function getAuthenticatedUserFromRequest(request: NextRequest | Request): Promise<AppwriteAuthUser | null> {
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) return null;
  return getUserFromJwt(jwt);
}

export type UserProfileRow = Models.Row & {
  email?: string;
  preferred_language?: string;
  is_premium?: boolean;
  rapido_pens?: number;
  rapido_fraction_cents?: number;
  progression_score?: number;
  wall_of_death_count?: number;
  earned_badges?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: string;
  subscription_current_period_start?: string;
  subscription_current_period_end?: string;
  subscription_cancel_at_period_end?: boolean;
  premium_started_at?: string;
  premium_price_cents?: number;
  premium_currency?: string;
  premium_interval?: string;
  premium_promo_code?: string;
  edu_verified?: boolean;
  edu_email?: string;
  edu_verification_code?: string;
  edu_verification_email?: string;
  edu_verification_expires?: string;
  referral_code?: string;
  referred_by?: string;
  referral_rewarded_at?: string;
};

export type MentorChatRow = Models.Row & {
  user_id: string;
  title: string;
  month_key: string;
  token_limit: number;
  tokens_used: number;
  is_premium_chat: boolean;
  status: string;
  last_message_at?: string;
};

export type MentorMessageRow = Models.Row & {
  chat_id: string;
  user_id: string;
  role: 'user' | 'mentor';
  content: string;
  tokens: number;
  attachment_name?: string;
  attachment_url?: string;
  attachment_mime?: string;
};

export type AnalysisFileCacheRow = Models.Row & {
  user_id: string;
  file_hash: string;
  last_operation: string;
  latest_summary: string;
  title_guess?: string;
  analysis_count: number;
};

export type MemorySnippetRow = Models.Row & {
  user_id: string;
  category: string;
  snippet: string;
  visible_to_user: boolean;
  deleted_by_user: boolean;
  delete_reason?: string;
  deleted_at?: string;
  updated_from_operation?: string;
};

export type BillingEventRow = Models.Row & {
  user_id: string;
  event_type: string;
  amount_cents: number;
  currency: string;
  rapido_delta: number;
  rapido_balance_after: number;
  stripe_session_id?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  metadata_json?: string;
};

export type PromoCodeRow = Models.Row & {
  code: string;
  title: string;
  description?: string;
  active: boolean;
  reward_kind: string;
  reward_value: number;
  reward_currency?: string;
  reward_interval?: string;
  checkout_modes?: string;
  target_scope?: string;
  max_total_uses?: number;
  max_uses_per_user?: number;
  used_count: number;
  starts_at?: string;
  ends_at?: string;
  min_rapido_purchase?: number;
  metadata_json?: string;
};

export type PromoRedemptionRow = Models.Row & {
  promo_code_id: string;
  promo_code: string;
  user_id: string;
  reward_kind: string;
  reward_value: number;
  reward_currency?: string;
  checkout_mode?: string;
  note?: string;
  metadata_json?: string;
  redeemed_at?: string;
};

export type FeatureFlagRow = Models.Row & {
  flag_key: string;
  enabled: boolean;
  value_json?: string;
};

export type NormalizedUserProfile = {
  id: string;
  email: string | null;
  preferred_language?: SupportedLanguage;
  is_premium: boolean;
  rapido_pens: number;
  rapido_fraction_cents: number;
  progression_score: number;
  wall_of_death_count: number;
  earned_badges: unknown[];
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_current_period_start: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
  premium_started_at: string | null;
  premium_price_cents: number | null;
  premium_currency: string | null;
  premium_interval: string | null;
  premium_promo_code: string | null;
  edu_verified: boolean;
  edu_email: string | null;
  edu_verification_code: string | null;
  edu_verification_email: string | null;
  edu_verification_expires: string | null;
  referral_code: string | null;
  referred_by: string | null;
  referral_rewarded_at: string | null;
};

export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(8);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
}

function safeParseBadges(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizeProfileRow(row: UserProfileRow): NormalizedUserProfile {
  const hasEmail = Boolean(row.email && row.email.trim());
  return {
    id: row.$id,
    email: row.email ?? null,
    preferred_language: normalizeLanguage(row.preferred_language, 'tr'),
    is_premium: Boolean(row.is_premium),
    rapido_pens: Number.isFinite(row.rapido_pens)
      ? Number(row.rapido_pens)
      : (hasEmail ? TIER_DEFAULTS.REGISTERED : TIER_DEFAULTS.ANONYMOUS),
    rapido_fraction_cents: Number.isFinite(row.rapido_fraction_cents) ? Number(row.rapido_fraction_cents) : 0,
    progression_score: Number.isFinite(row.progression_score) ? Number(row.progression_score) : 0,
    wall_of_death_count: Number.isFinite(row.wall_of_death_count) ? Number(row.wall_of_death_count) : 0,
    earned_badges: safeParseBadges(row.earned_badges),
    stripe_customer_id: row.stripe_customer_id || null,
    stripe_subscription_id: row.stripe_subscription_id || null,
    subscription_status: row.subscription_status || null,
    subscription_current_period_start: row.subscription_current_period_start || null,
    subscription_current_period_end: row.subscription_current_period_end || null,
    subscription_cancel_at_period_end: Boolean(row.subscription_cancel_at_period_end),
    premium_started_at: row.premium_started_at || null,
    premium_price_cents: Number.isFinite(row.premium_price_cents) ? Number(row.premium_price_cents) : null,
    premium_currency: row.premium_currency || null,
    premium_interval: row.premium_interval || null,
    premium_promo_code: row.premium_promo_code || null,
    edu_verified: Boolean(row.edu_verified),
    edu_email: row.edu_email || null,
    edu_verification_code: row.edu_verification_code || null,
    edu_verification_email: row.edu_verification_email || null,
    edu_verification_expires: row.edu_verification_expires || null,
    referral_code: row.referral_code || null,
    referred_by: row.referred_by || null,
    referral_rewarded_at: row.referral_rewarded_at || null,
  };
}

export async function getOrCreateProfile(user: AppwriteAuthUser): Promise<NormalizedUserProfile> {
  const tables = getAdminTables();

  try {
    const row = await tables.getRow<UserProfileRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROFILES_ID,
      rowId: user.id,
    });
    return normalizeProfileRow(row);
  } catch (error: any) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }
  }

  const isAnonymous = !user.email;
  let earlyRegistrationBonus = 0;

  if (!isAnonymous) {
    try {
      const registeredCount = await tables.listRows<UserProfileRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_PROFILES_ID,
        queries: [
          Query.notEqual('email', ''),
          Query.createdAfter(EARLY_REGISTRATION_BONUS_START_AT),
          Query.limit(1),
        ],
        total: true,
      });

      if (registeredCount.total < EARLY_REGISTRATION_BONUS_LIMIT) {
        earlyRegistrationBonus = EARLY_REGISTRATION_BONUS_RAPIDO;
      }
    } catch {
      earlyRegistrationBonus = 0;
    }
  }

  const initialRapido = isAnonymous
    ? TIER_DEFAULTS.ANONYMOUS
    : TIER_DEFAULTS.REGISTERED + earlyRegistrationBonus;

  try {
    const created = await tables.createRow<UserProfileRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROFILES_ID,
      rowId: user.id,
      data: {
        email: user.email ?? '',
        preferred_language: 'tr',
        is_premium: false,
        rapido_pens: initialRapido,
        rapido_fraction_cents: 0,
        progression_score: 0,
        wall_of_death_count: 0,
        earned_badges: '[]',
        stripe_customer_id: '',
        stripe_subscription_id: '',
        subscription_status: '',
        subscription_current_period_start: '',
        subscription_current_period_end: '',
        subscription_cancel_at_period_end: false,
        premium_started_at: '',
        premium_price_cents: 0,
        premium_currency: '',
        premium_interval: '',
        premium_promo_code: '',
        edu_verified: false,
        edu_email: '',
        edu_verification_code: '',
        edu_verification_email: '',
        referral_code: generateReferralCode(),
        referred_by: '',
      },
    });

    return normalizeProfileRow(created);
  } catch (error) {
    if (!isAppwriteConflict(error)) {
      throw error;
    }

    const existing = await tables.getRow<UserProfileRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROFILES_ID,
      rowId: user.id,
    });

    return normalizeProfileRow(existing);
  }
}

export async function updateProfileById(userId: string, data: Record<string, unknown>) {
  const tables = getAdminTables();
  return tables.updateRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_PROFILES_ID,
    rowId: userId,
    data,
  });
}

export async function recordBillingEvent(event: {
  userId: string;
  eventType: string;
  amountCents: number;
  currency: string;
  rapidoDelta: number;
  rapidoBalanceAfter: number;
  stripeSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const tables = getAdminTables();
  return tables.createRow<BillingEventRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_BILLING_EVENTS_ID,
    rowId: ID.unique(),
    data: {
      user_id: event.userId,
      event_type: event.eventType,
      amount_cents: Math.max(0, Math.floor(event.amountCents)),
      currency: (event.currency || 'try').toLowerCase(),
      rapido_delta: Math.trunc(event.rapidoDelta),
      rapido_balance_after: Math.max(0, Math.trunc(event.rapidoBalanceAfter)),
      stripe_session_id: event.stripeSessionId ?? '',
      stripe_customer_id: event.stripeCustomerId ?? '',
      stripe_subscription_id: event.stripeSubscriptionId ?? '',
      metadata_json: event.metadata ? JSON.stringify(event.metadata) : '',
    },
  });
}

export async function getFeatureFlag(flagKey: string): Promise<FeatureFlagRow | null> {
  const tables = getAdminTables();
  try {
    const rows = await tables.listRows<FeatureFlagRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_FEATURE_FLAGS_ID,
      queries: [
        Query.equal('flag_key', flagKey),
        Query.limit(1),
      ],
    });
    return rows.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function findProfileByReferralCode(code: string): Promise<NormalizedUserProfile | null> {
  const tables = getAdminTables();
  const rows = await tables.listRows<UserProfileRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_PROFILES_ID,
    queries: [
      Query.equal('referral_code', code),
      Query.limit(1),
    ],
  });
  if (!rows.rows.length) return null;
  return normalizeProfileRow(rows.rows[0]);
}

export async function findProfileBySubscriptionId(subscriptionId: string): Promise<NormalizedUserProfile | null> {
  const tables = getAdminTables();
  const rows = await tables.listRows<UserProfileRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_PROFILES_ID,
    queries: [
      Query.equal('stripe_subscription_id', subscriptionId),
      Query.limit(1),
    ],
  });

  if (!rows.rows.length) return null;
  return normalizeProfileRow(rows.rows[0]);
}

export async function markStripeEventProcessed(eventId: string): Promise<boolean> {
  const tables = getAdminTables();
  try {
    await tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_STRIPE_EVENTS_ID,
      rowId: ID.unique(),
      data: {
        event_id: eventId,
        processed_at: new Date().toISOString(),
      },
    });
    return false;
  } catch (error: any) {
    if (error?.code === 409) {
      return true;
    }
    throw error;
  }
}
