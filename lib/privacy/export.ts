import {
  APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID,
  APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
  APPWRITE_TABLE_BILLING_EVENTS_ID,
  APPWRITE_TABLE_CONFESSIONS_ID,
  APPWRITE_TABLE_FEEDBACK_ID,
  APPWRITE_TABLE_GALLERY_ID,
  APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
  APPWRITE_TABLE_MENTOR_CHATS_ID,
  APPWRITE_TABLE_MENTOR_MESSAGES_ID,
  APPWRITE_TABLE_PEER_REVIEWS_ID,
  APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID,
  APPWRITE_TABLE_PORTFOLIOS_ID,
  APPWRITE_TABLE_PORTFOLIO_PAGES_ID,
  APPWRITE_TABLE_PROFILES_ID,
  APPWRITE_TABLE_PROMO_REDEMPTIONS_ID,
} from '@/lib/appwrite/server';
import { collectAllRows, type PrivacyDataPort, type PrivacyRow } from '@/lib/privacy/data-port';

export const EXPORT_FORMAT_VERSION = 'dod-export/2026-10-13.v1';

const MAX_ROWS_PER_CLASS = 5_000;

/**
 * Documented export classes. Each lists the owner column it is filtered on and the ONLY
 * columns copied out — everything else (internal ids of other users, OTP codes, moderation
 * internals, raw billing metadata) is excluded by construction.
 */
export const EXPORT_DATA_CLASSES = [
  {
    key: 'profile',
    tableId: APPWRITE_TABLE_PROFILES_ID,
    ownerColumn: 'user_id',
    fields: [
      'email', 'preferred_language', 'is_premium', 'rapido_pens', 'rapido_fraction_cents', 'progression_score',
      'wall_of_death_count', 'earned_badges', 'subscription_status', 'subscription_current_period_start',
      'subscription_current_period_end', 'subscription_cancel_at_period_end', 'premium_started_at',
      'premium_price_cents', 'premium_currency', 'premium_interval', 'premium_promo_code', 'edu_verified',
      'edu_email', 'referral_code', 'referred_by', 'referral_rewarded_at',
    ],
  },
  {
    key: 'analysisHistory',
    tableId: APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
    ownerColumn: 'user_id',
    fields: [
      'title', 'critique', 'score', 'gallery_type', 'analysis_kind', 'preview_url', 'source_url', 'source_mime',
      'is_deleted', 'deleted_at', 'purge_after',
    ],
  },
  {
    key: 'analysisFileSummaries',
    tableId: APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID,
    ownerColumn: 'user_id',
    fields: ['file_hash', 'last_operation', 'latest_summary', 'title_guess', 'analysis_count'],
  },
  {
    key: 'gallerySubmissions',
    tableId: APPWRITE_TABLE_GALLERY_ID,
    ownerColumn: 'user_id',
    fields: ['title', 'jury_quote', 'gallery_type', 'status', 'analysis_kind', 'public_url', 'source_mime'],
  },
  {
    key: 'mentorChats',
    tableId: APPWRITE_TABLE_MENTOR_CHATS_ID,
    ownerColumn: 'user_id',
    fields: ['title', 'month_key', 'token_limit', 'tokens_used', 'is_premium_chat', 'status', 'last_message_at'],
  },
  {
    key: 'mentorMessages',
    tableId: APPWRITE_TABLE_MENTOR_MESSAGES_ID,
    ownerColumn: 'user_id',
    fields: ['chat_id', 'role', 'content', 'tokens', 'attachment_name', 'attachment_url', 'attachment_mime'],
  },
  {
    // Includes memory the UI hides (visible_to_user = false): it is still personal data about the user.
    key: 'aiMemory',
    tableId: APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
    ownerColumn: 'user_id',
    fields: ['category', 'snippet', 'visible_to_user', 'deleted_by_user', 'delete_reason', 'deleted_at'],
  },
  {
    key: 'billingEvents',
    tableId: APPWRITE_TABLE_BILLING_EVENTS_ID,
    ownerColumn: 'user_id',
    fields: ['event_type', 'amount_cents', 'currency', 'rapido_delta', 'rapido_balance_after'],
  },
  {
    key: 'promoRedemptions',
    tableId: APPWRITE_TABLE_PROMO_REDEMPTIONS_ID,
    ownerColumn: 'user_id',
    fields: ['promo_code', 'reward_kind', 'reward_value', 'reward_currency', 'checkout_mode', 'redeemed_at'],
  },
  {
    key: 'feedback',
    tableId: APPWRITE_TABLE_FEEDBACK_ID,
    ownerColumn: 'user_id',
    fields: ['email', 'category', 'message', 'source_path', 'rating', 'status'],
  },
  {
    key: 'confessions',
    tableId: APPWRITE_TABLE_CONFESSIONS_ID,
    ownerColumn: 'user_id',
    fields: ['text', 'image_url', 'status', 'likes'],
  },
  {
    key: 'peerReviewsWritten',
    tableId: APPWRITE_TABLE_PEER_REVIEWS_ID,
    ownerColumn: 'reviewer_user_id',
    fields: ['reviewer_display', 'body', 'rating', 'created_at'],
  },
  {
    key: 'peerReviewOpenings',
    tableId: APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID,
    ownerColumn: 'owner_user_id',
    fields: ['submission_id', 'opened_at', 'review_count', 'max_reviews', 'status'],
  },
  {
    key: 'portfolios',
    tableId: APPWRITE_TABLE_PORTFOLIOS_ID,
    ownerColumn: 'user_id',
    fields: ['title', 'subtitle', 'cover_url', 'page_count', 'is_public', 'share_slug', 'last_published_at'],
  },
  {
    key: 'portfolioPages',
    tableId: APPWRITE_TABLE_PORTFOLIO_PAGES_ID,
    ownerColumn: 'user_id',
    fields: ['portfolio_id', 'page_index', 'plan_json', 'layout_json'],
  },
] as const;

export type ExportDataClassKey = (typeof EXPORT_DATA_CLASSES)[number]['key'];

export type ExportedRecord = { id: string; createdAt: string | null; updatedAt: string | null } & Record<string, unknown>;

export type AccountExport = {
  formatVersion: string;
  generatedAt: string;
  account: { id: string; email: string | null; name: string | null; createdAt: string | null };
  data: Record<ExportDataClassKey, ExportedRecord[]>;
  manifest: Array<{ dataClass: ExportDataClassKey; count: number }>;
  notStoredServerSide: string[];
};

function pickFields(row: PrivacyRow, fields: readonly string[]): ExportedRecord {
  const record: ExportedRecord = {
    id: row.$id,
    createdAt: typeof row.$createdAt === 'string' ? row.$createdAt : null,
    updatedAt: typeof row.$updatedAt === 'string' ? row.$updatedAt : null,
  };
  for (const field of fields) {
    const value = row[field];
    if (value !== undefined && value !== null) record[field] = value;
  }
  return record;
}

export async function buildAccountExport(input: {
  port: PrivacyDataPort;
  user: { id: string; email: string | null; name: string | null; createdAt?: string | null };
  now?: Date;
}): Promise<AccountExport> {
  const { port, user } = input;
  const data = {} as Record<ExportDataClassKey, ExportedRecord[]>;
  const manifest: AccountExport['manifest'] = [];

  for (const dataClass of EXPORT_DATA_CLASSES) {
    const rows = await collectAllRows(
      port,
      dataClass.tableId,
      { column: dataClass.ownerColumn, value: user.id },
      MAX_ROWS_PER_CLASS,
    );
    // Defence in depth: never emit a row whose owner column is not this user.
    const ownRows = rows.filter((row) => row[dataClass.ownerColumn] === user.id);
    data[dataClass.key] = ownRows.map((row) => pickFields(row, dataClass.fields));
    manifest.push({ dataClass: dataClass.key, count: ownRows.length });
  }

  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    generatedAt: (input.now ?? new Date()).toISOString(),
    account: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt ?? null },
    data,
    manifest,
    notStoredServerSide: [
      'cookie_consent: stored only in your browser (cookie + localStorage)',
      'payment_card_details: held only by Stripe',
    ],
  };
}
