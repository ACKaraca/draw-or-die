import {
  Compression,
  OrderBy,
  Permission,
  Role,
  Storage,
  TablesDB,
  TablesDBIndexType,
} from 'node-appwrite';
import {
  APPWRITE_BUCKET_GALLERY_ID,
  APPWRITE_TABLE_BILLING_EVENTS_ID,
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID,
  APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
  APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
  APPWRITE_TABLE_GALLERY_ID,
  APPWRITE_TABLE_MENTOR_CHATS_ID,
  APPWRITE_TABLE_MENTOR_MESSAGES_ID,
  APPWRITE_TABLE_FEEDBACK_ID,
  APPWRITE_TABLE_PROFILES_ID,
  APPWRITE_TABLE_PROMO_CODES_ID,
  APPWRITE_TABLE_PROMO_REDEMPTIONS_ID,
  APPWRITE_TABLE_STRIPE_EVENTS_ID,
  APPWRITE_TABLE_FEATURE_FLAGS_ID,
  createAdminClient,
} from '@/lib/appwrite/server';
import { getAppwriteErrorDetails, isAppwriteConflict, isAppwriteNotFound } from '@/lib/appwrite/error-utils';

const ENSURE_TTL_MS = 5 * 60 * 1000;

let coreEnsuredAt = 0;
let coreEnsurePromise: Promise<void> | null = null;
let commerceEnsuredAt = 0;
let commerceEnsurePromise: Promise<void> | null = null;

function isNotFound(error: unknown): boolean {
  return isAppwriteNotFound(error);
}

function isConflict(error: unknown): boolean {
  return isAppwriteConflict(error);
}

function isResourceLimitError(error: unknown): boolean {
  const details = getAppwriteErrorDetails(error);
  const type = `${details.type ?? ''} ${details.responseType ?? ''}`.trim().toLowerCase();
  const message = `${details.message ?? ''} ${details.responseMessage ?? ''}`.trim().toLowerCase();

  return (type.includes('limit') && !type.includes('rate_limit'))
    || type.includes('column_limit_exceeded')
    || message.includes('maximum number or size of columns')
    || message.includes('maximum number of indexes')
    || message.includes('limit has been reached');
}

async function ensureDatabase(tables: TablesDB): Promise<void> {
  try {
    await tables.get({ databaseId: APPWRITE_DATABASE_ID });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    try {
      await tables.create({
        databaseId: APPWRITE_DATABASE_ID,
        name: 'Draw or Die',
        enabled: true,
      });
    } catch (createError) {
      if (!isConflict(createError)) throw createError;
    }
  }
}

async function ensureTable(tables: TablesDB, tableId: string, name: string): Promise<void> {
  try {
    await tables.getTable({ databaseId: APPWRITE_DATABASE_ID, tableId });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    try {
      await tables.createTable({
        databaseId: APPWRITE_DATABASE_ID,
        tableId,
        name,
        rowSecurity: false,
        enabled: true,
      });
    } catch (createError) {
      if (!isConflict(createError)) throw createError;
    }
  }
}

async function ensureStringColumn(
  tables: TablesDB,
  tableId: string,
  key: string,
  size: number,
  required: boolean,
  defaultValue?: string,
  array = false,
  encrypt = false,
): Promise<void> {
  try {
    await tables.getColumn({ databaseId: APPWRITE_DATABASE_ID, tableId, key });
  } catch (error) {
    if (isResourceLimitError(error)) return;
    if (!isNotFound(error)) throw error;
    try {
      const payload = {
        databaseId: APPWRITE_DATABASE_ID,
        tableId,
        key,
        size,
        required,
        array,
        encrypt,
        ...(required || defaultValue === undefined ? {} : { xdefault: defaultValue }),
      };

      await tables.createStringColumn({
        ...payload,
      });
    } catch (createError) {
      if (isResourceLimitError(createError)) return;
      if (!isConflict(createError)) throw createError;
    }
  }
}

async function ensureBooleanColumn(
  tables: TablesDB,
  tableId: string,
  key: string,
  required: boolean,
  defaultValue?: boolean,
  array = false,
): Promise<void> {
  try {
    await tables.getColumn({ databaseId: APPWRITE_DATABASE_ID, tableId, key });
  } catch (error) {
    if (isResourceLimitError(error)) return;
    if (!isNotFound(error)) throw error;
    try {
      const payload = {
        databaseId: APPWRITE_DATABASE_ID,
        tableId,
        key,
        required,
        array,
        ...(required || defaultValue === undefined ? {} : { xdefault: defaultValue }),
      };

      await tables.createBooleanColumn({
        ...payload,
      });
    } catch (createError) {
      if (isResourceLimitError(createError)) return;
      if (!isConflict(createError)) throw createError;
    }
  }
}

async function ensureIntegerColumn(
  tables: TablesDB,
  tableId: string,
  key: string,
  required: boolean,
  defaultValue?: number,
  min?: number,
  max?: number,
  array = false,
): Promise<void> {
  try {
    await tables.getColumn({ databaseId: APPWRITE_DATABASE_ID, tableId, key });
  } catch (error) {
    if (isResourceLimitError(error)) return;
    if (!isNotFound(error)) throw error;
    try {
      const payload = {
        databaseId: APPWRITE_DATABASE_ID,
        tableId,
        key,
        required,
        min,
        max,
        array,
        ...(required || defaultValue === undefined ? {} : { xdefault: defaultValue }),
      };

      await tables.createIntegerColumn({
        ...payload,
      });
    } catch (createError) {
      if (isResourceLimitError(createError)) return;
      if (!isConflict(createError)) throw createError;
    }
  }
}

async function ensureDatetimeColumn(
  tables: TablesDB,
  tableId: string,
  key: string,
  required: boolean,
  defaultValue?: string,
  array = false,
): Promise<void> {
  try {
    await tables.getColumn({ databaseId: APPWRITE_DATABASE_ID, tableId, key });
  } catch (error) {
    if (isResourceLimitError(error)) return;
    if (!isNotFound(error)) throw error;
    try {
      const payload = {
        databaseId: APPWRITE_DATABASE_ID,
        tableId,
        key,
        required,
        array,
        ...(required || defaultValue === undefined ? {} : { xdefault: defaultValue }),
      };

      await tables.createDatetimeColumn({
        ...payload,
      });
    } catch (createError) {
      if (isResourceLimitError(createError)) return;
      if (!isConflict(createError)) throw createError;
    }
  }
}

async function ensureIndex(
  tables: TablesDB,
  tableId: string,
  key: string,
  type: TablesDBIndexType,
  columns: string[],
  orders?: OrderBy[],
): Promise<void> {
  try {
    await tables.getIndex({ databaseId: APPWRITE_DATABASE_ID, tableId, key });
  } catch (error) {
    if (isResourceLimitError(error)) return;
    if (!isNotFound(error)) throw error;
    try {
      await tables.createIndex({
        databaseId: APPWRITE_DATABASE_ID,
        tableId,
        key,
        type,
        columns,
        orders,
      });
    } catch (createError) {
      if (isResourceLimitError(createError)) return;
      if (!isConflict(createError)) throw createError;
    }
  }
}

async function runBootstrapStep(stepName: string, operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (isResourceLimitError(error)) {
      console.warn(`[appwrite-bootstrap] '${stepName}' atlandi: kaynak limiti asildi.`);
      return;
    }
    throw error;
  }
}

async function ensureBucket(storage: Storage): Promise<void> {
  const desiredPermissions = [
    Permission.read(Role.any()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
  const desiredMaxFileSize = 35 * 1024 * 1024;
  const desiredExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

  try {
    const existing = await storage.getBucket({ bucketId: APPWRITE_BUCKET_GALLERY_ID });

    const existingExtensions = Array.isArray(existing.allowedFileExtensions)
      ? existing.allowedFileExtensions.map((value) => String(value).toLowerCase())
      : [];
    const missingExtension = desiredExtensions.some((ext) => !existingExtensions.includes(ext));
    const needsUpdate =
      (typeof existing.maximumFileSize === 'number' ? existing.maximumFileSize : 0) < desiredMaxFileSize
      || missingExtension
      || existing.enabled !== true
      || existing.fileSecurity !== false;

    if (!needsUpdate) {
      return;
    }

    await storage.updateBucket({
      bucketId: APPWRITE_BUCKET_GALLERY_ID,
      name: existing.name || 'Gallery',
      permissions: Array.isArray(existing.$permissions) && existing.$permissions.length > 0
        ? existing.$permissions
        : desiredPermissions,
      fileSecurity: false,
      enabled: true,
      maximumFileSize: desiredMaxFileSize,
      allowedFileExtensions: desiredExtensions,
      compression: Compression.Gzip,
      encryption: true,
      antivirus: true,
    });

    return;
  } catch (error) {
    if (!isNotFound(error)) throw error;
    try {
      await storage.createBucket({
        bucketId: APPWRITE_BUCKET_GALLERY_ID,
        name: 'Gallery',
        permissions: desiredPermissions,
        fileSecurity: false,
        enabled: true,
        maximumFileSize: desiredMaxFileSize,
        allowedFileExtensions: desiredExtensions,
        compression: Compression.Gzip,
        encryption: true,
        antivirus: true,
      });
    } catch (createError) {
      if (!isConflict(createError)) throw createError;
    }
  }
}

async function setupProfilesTable(tables: TablesDB): Promise<void> {
  await ensureTable(tables, APPWRITE_TABLE_PROFILES_ID, 'Profiles');

  await ensureStringColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'email', 255, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'preferred_language', 8, false, 'tr');
  await ensureBooleanColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'is_premium', true, false);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'rapido_pens', true, 15, 0, 1_000_000);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'rapido_fraction_cents', true, 0, 0, 99);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'progression_score', true, 0, 0, 1_000_000);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'wall_of_death_count', true, 0, 0, 1_000_000);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'earned_badges', 10_000, true, '[]');
  await ensureStringColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'stripe_customer_id', 255, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'stripe_subscription_id', 255, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'subscription_status', 32, false);
  await ensureDatetimeColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'subscription_current_period_start', false);
  await ensureDatetimeColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'subscription_current_period_end', false);
  await ensureBooleanColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'subscription_cancel_at_period_end', true, false);
  await ensureDatetimeColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'premium_started_at', false);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'premium_price_cents', false, undefined, 0, 100_000_000);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'premium_currency', 8, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'premium_interval', 16, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'premium_promo_code', 64, false);
  await ensureBooleanColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'edu_verified', true, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'edu_email', 255, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'edu_verification_code', 16, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'edu_verification_email', 255, false);
  await ensureDatetimeColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'edu_verification_expires', false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'referral_code', 16, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'referred_by', 16, false);
  await ensureDatetimeColumn(tables, APPWRITE_TABLE_PROFILES_ID, 'referral_rewarded_at', false);

  await ensureIndex(
    tables,
    APPWRITE_TABLE_PROFILES_ID,
    'profiles_subscription_idx',
    TablesDBIndexType.Key,
    ['stripe_subscription_id'],
    [OrderBy.Asc],
  );

  await ensureIndex(
    tables,
    APPWRITE_TABLE_PROFILES_ID,
    'profiles_referral_code_idx',
    TablesDBIndexType.Unique,
    ['referral_code'],
    [OrderBy.Asc],
  );

  await ensureIndex(
    tables,
    APPWRITE_TABLE_PROFILES_ID,
    'profiles_referred_by_idx',
    TablesDBIndexType.Key,
    ['referred_by'],
    [OrderBy.Asc],
  );
}

async function setupGalleryTable(tables: TablesDB): Promise<void> {
  await ensureTable(tables, APPWRITE_TABLE_GALLERY_ID, 'Gallery Submissions');

  await ensureStringColumn(tables, APPWRITE_TABLE_GALLERY_ID, 'user_id', 64, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_GALLERY_ID, 'title', 255, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_GALLERY_ID, 'jury_quote', 8_000, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_GALLERY_ID, 'gallery_type', 32, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_GALLERY_ID, 'status', 32, true, 'pending');
  await ensureStringColumn(tables, APPWRITE_TABLE_GALLERY_ID, 'analysis_kind', 64, false);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_GALLERY_ID, 'preview_width', false, undefined, 1, 10000);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_GALLERY_ID, 'preview_height', false, undefined, 1, 10000);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_GALLERY_ID, 'aspect_ratio_milli', false, undefined, 100, 4000);
  await ensureStringColumn(tables, APPWRITE_TABLE_GALLERY_ID, 'source_mime', 64, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_GALLERY_ID, 'moderation_reason', 500, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_GALLERY_ID, 'public_url', 2_048, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_GALLERY_ID, 'storage_path', 255, false);

  await ensureIndex(
    tables,
    APPWRITE_TABLE_GALLERY_ID,
    'gallery_status_idx',
    TablesDBIndexType.Key,
    ['status'],
    [OrderBy.Asc],
  );

  await ensureIndex(
    tables,
    APPWRITE_TABLE_GALLERY_ID,
    'gallery_type_idx',
    TablesDBIndexType.Key,
    ['gallery_type'],
    [OrderBy.Asc],
  );
}

async function setupStripeEventsTable(tables: TablesDB): Promise<void> {
  await ensureTable(tables, APPWRITE_TABLE_STRIPE_EVENTS_ID, 'Stripe Events');

  await ensureStringColumn(tables, APPWRITE_TABLE_STRIPE_EVENTS_ID, 'event_id', 128, true);
  await ensureDatetimeColumn(tables, APPWRITE_TABLE_STRIPE_EVENTS_ID, 'processed_at', true);

  await ensureIndex(
    tables,
    APPWRITE_TABLE_STRIPE_EVENTS_ID,
    'stripe_event_unique',
    TablesDBIndexType.Unique,
    ['event_id'],
    [OrderBy.Asc],
  );
}

async function setupBillingEventsTable(tables: TablesDB): Promise<void> {
  await ensureTable(tables, APPWRITE_TABLE_BILLING_EVENTS_ID, 'Billing Events');

  await ensureStringColumn(tables, APPWRITE_TABLE_BILLING_EVENTS_ID, 'user_id', 64, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_BILLING_EVENTS_ID, 'event_type', 64, true);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_BILLING_EVENTS_ID, 'amount_cents', true, 0, 0, 100_000_000);
  await ensureStringColumn(tables, APPWRITE_TABLE_BILLING_EVENTS_ID, 'currency', 8, true, 'try');
  await ensureIntegerColumn(tables, APPWRITE_TABLE_BILLING_EVENTS_ID, 'rapido_delta', true, 0, -1_000_000, 1_000_000);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_BILLING_EVENTS_ID, 'rapido_balance_after', true, 0, 0, 1_000_000);
  await ensureStringColumn(tables, APPWRITE_TABLE_BILLING_EVENTS_ID, 'stripe_session_id', 255, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_BILLING_EVENTS_ID, 'stripe_customer_id', 255, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_BILLING_EVENTS_ID, 'stripe_subscription_id', 255, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_BILLING_EVENTS_ID, 'metadata_json', 10_000, false);

  await ensureIndex(
    tables,
    APPWRITE_TABLE_BILLING_EVENTS_ID,
    'billing_events_user_idx',
    TablesDBIndexType.Key,
    ['user_id'],
    [OrderBy.Asc],
  );

  await ensureIndex(
    tables,
    APPWRITE_TABLE_BILLING_EVENTS_ID,
    'billing_events_session_idx',
    TablesDBIndexType.Key,
    ['stripe_session_id'],
    [OrderBy.Asc],
  );
}

async function setupAnalysisHistoryTable(tables: TablesDB): Promise<void> {
  await ensureTable(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'Analysis History');

  await ensureStringColumn(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'user_id', 64, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'title', 255, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'critique', 10_000, true);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'score', false, undefined, 0, 100);
  await ensureStringColumn(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'gallery_type', 32, true, 'NONE');
  await ensureStringColumn(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'analysis_kind', 32, true, 'SINGLE_JURY');
  await ensureStringColumn(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'preview_url', 2_048, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'source_url', 2_048, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'source_mime', 64, false);
  await ensureBooleanColumn(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'is_deleted', true, false);
  await ensureDatetimeColumn(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'deleted_at', false);
  await ensureDatetimeColumn(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'purge_after', false);

  await ensureIndex(
    tables,
    APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
    'analysis_user_idx',
    TablesDBIndexType.Key,
    ['user_id'],
    [OrderBy.Asc],
  );
}

async function setupAnalysisFileCacheTable(tables: TablesDB): Promise<void> {
  await ensureTable(tables, APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID, 'Analysis File Cache');

  await ensureStringColumn(tables, APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID, 'user_id', 64, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID, 'file_hash', 128, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID, 'last_operation', 64, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID, 'latest_summary', 12000, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID, 'title_guess', 255, false);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID, 'analysis_count', true, 1, 1, 1000000);

  await ensureIndex(
    tables,
    APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID,
    'analysis_file_cache_user_idx',
    TablesDBIndexType.Key,
    ['user_id'],
    [OrderBy.Asc],
  );

  await ensureIndex(
    tables,
    APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID,
    'analysis_file_cache_hash_idx',
    TablesDBIndexType.Unique,
    ['user_id', 'file_hash'],
    [OrderBy.Asc, OrderBy.Asc],
  );
}

async function setupMemorySnippetsTable(tables: TablesDB): Promise<void> {
  await ensureTable(tables, APPWRITE_TABLE_MEMORY_SNIPPETS_ID, 'AI Memory Snippets');

  await ensureStringColumn(tables, APPWRITE_TABLE_MEMORY_SNIPPETS_ID, 'user_id', 64, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_MEMORY_SNIPPETS_ID, 'category', 32, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_MEMORY_SNIPPETS_ID, 'snippet', 12000, true);
  await ensureBooleanColumn(tables, APPWRITE_TABLE_MEMORY_SNIPPETS_ID, 'visible_to_user', true, true);
  await ensureBooleanColumn(tables, APPWRITE_TABLE_MEMORY_SNIPPETS_ID, 'deleted_by_user', true, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_MEMORY_SNIPPETS_ID, 'delete_reason', 255, false);
  await ensureDatetimeColumn(tables, APPWRITE_TABLE_MEMORY_SNIPPETS_ID, 'deleted_at', false);
  await ensureStringColumn(tables, APPWRITE_TABLE_MEMORY_SNIPPETS_ID, 'updated_from_operation', 64, false);

  await ensureIndex(
    tables,
    APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
    'memory_snippets_user_idx',
    TablesDBIndexType.Key,
    ['user_id'],
    [OrderBy.Asc],
  );

  await ensureIndex(
    tables,
    APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
    'memory_snippets_user_category_idx',
    TablesDBIndexType.Unique,
    ['user_id', 'category'],
    [OrderBy.Asc, OrderBy.Asc],
  );
}

async function setupMentorChatsTable(tables: TablesDB): Promise<void> {
  await ensureTable(tables, APPWRITE_TABLE_MENTOR_CHATS_ID, 'Mentor Chats');

  await ensureStringColumn(tables, APPWRITE_TABLE_MENTOR_CHATS_ID, 'user_id', 64, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_MENTOR_CHATS_ID, 'title', 255, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_MENTOR_CHATS_ID, 'month_key', 16, true);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_MENTOR_CHATS_ID, 'token_limit', true, 6000, 1, 200000);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_MENTOR_CHATS_ID, 'tokens_used', true, 0, 0, 200000);
  await ensureBooleanColumn(tables, APPWRITE_TABLE_MENTOR_CHATS_ID, 'is_premium_chat', true, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_MENTOR_CHATS_ID, 'status', 32, true, 'active');
  await ensureDatetimeColumn(tables, APPWRITE_TABLE_MENTOR_CHATS_ID, 'last_message_at', false);

  await ensureIndex(
    tables,
    APPWRITE_TABLE_MENTOR_CHATS_ID,
    'mentor_chats_user_idx',
    TablesDBIndexType.Key,
    ['user_id'],
    [OrderBy.Asc],
  );

  await ensureIndex(
    tables,
    APPWRITE_TABLE_MENTOR_CHATS_ID,
    'mentor_chats_month_idx',
    TablesDBIndexType.Key,
    ['user_id', 'month_key'],
    [OrderBy.Asc, OrderBy.Asc],
  );
}

async function setupMentorMessagesTable(tables: TablesDB): Promise<void> {
  await ensureTable(tables, APPWRITE_TABLE_MENTOR_MESSAGES_ID, 'Mentor Messages');

  await ensureStringColumn(tables, APPWRITE_TABLE_MENTOR_MESSAGES_ID, 'chat_id', 64, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_MENTOR_MESSAGES_ID, 'user_id', 64, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_MENTOR_MESSAGES_ID, 'role', 16, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_MENTOR_MESSAGES_ID, 'content', 12_000, true);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_MENTOR_MESSAGES_ID, 'tokens', true, 0, 0, 200000);
  await ensureStringColumn(tables, APPWRITE_TABLE_MENTOR_MESSAGES_ID, 'attachment_name', 255, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_MENTOR_MESSAGES_ID, 'attachment_url', 2_048, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_MENTOR_MESSAGES_ID, 'attachment_mime', 64, false);

  await ensureIndex(
    tables,
    APPWRITE_TABLE_MENTOR_MESSAGES_ID,
    'mentor_messages_chat_idx',
    TablesDBIndexType.Key,
    ['chat_id'],
    [OrderBy.Asc],
  );
}

async function setupFeedbackTable(tables: TablesDB): Promise<void> {
  await ensureTable(tables, APPWRITE_TABLE_FEEDBACK_ID, 'Feedback Entries');

  await ensureStringColumn(tables, APPWRITE_TABLE_FEEDBACK_ID, 'user_id', 64, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_FEEDBACK_ID, 'email', 255, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_FEEDBACK_ID, 'category', 32, true, 'general');
  await ensureStringColumn(tables, APPWRITE_TABLE_FEEDBACK_ID, 'message', 6000, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_FEEDBACK_ID, 'source_path', 255, false);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_FEEDBACK_ID, 'rating', false, undefined, 1, 5);
  await ensureStringColumn(tables, APPWRITE_TABLE_FEEDBACK_ID, 'status', 32, true, 'new');
  await ensureStringColumn(tables, APPWRITE_TABLE_FEEDBACK_ID, 'meta_json', 8000, false);

  await ensureIndex(
    tables,
    APPWRITE_TABLE_FEEDBACK_ID,
    'feedback_status_idx',
    TablesDBIndexType.Key,
    ['status'],
    [OrderBy.Asc],
  );

  await ensureIndex(
    tables,
    APPWRITE_TABLE_FEEDBACK_ID,
    'feedback_user_idx',
    TablesDBIndexType.Key,
    ['user_id'],
    [OrderBy.Asc],
  );
}

async function setupFeatureFlagsTable(tables: TablesDB): Promise<void> {
  await ensureTable(tables, APPWRITE_TABLE_FEATURE_FLAGS_ID, 'Feature Flags');

  await ensureStringColumn(tables, APPWRITE_TABLE_FEATURE_FLAGS_ID, 'flag_key', 64, true);
  await ensureBooleanColumn(tables, APPWRITE_TABLE_FEATURE_FLAGS_ID, 'enabled', true, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_FEATURE_FLAGS_ID, 'value_json', 4000, false);

  await ensureIndex(
    tables,
    APPWRITE_TABLE_FEATURE_FLAGS_ID,
    'feature_flags_key_idx',
    TablesDBIndexType.Unique,
    ['flag_key'],
    [OrderBy.Asc],
  );
}

async function setupPromoCodesTable(tables: TablesDB): Promise<void> {
  await ensureTable(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'Promo Codes');

  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'code', 64, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'title', 255, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'description', 6000, false);
  await ensureBooleanColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'active', true, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'reward_kind', 32, true, 'rapido');
  await ensureIntegerColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'reward_value', true, 0, 0, 100000000);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'reward_currency', 8, false, 'try');
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'reward_interval', 16, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'checkout_modes', 128, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'target_scope', 64, false, 'any');
  await ensureIntegerColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'max_total_uses', false, undefined, 1, 1000000);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'max_uses_per_user', false, undefined, 1, 1000000);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'used_count', true, 0, 0, 1000000);
  await ensureDatetimeColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'starts_at', false);
  await ensureDatetimeColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'ends_at', false);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'min_rapido_purchase', false, undefined, 1, 1000000);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_CODES_ID, 'metadata_json', 10000, false);

  await ensureIndex(
    tables,
    APPWRITE_TABLE_PROMO_CODES_ID,
    'promo_codes_code_idx',
    TablesDBIndexType.Unique,
    ['code'],
    [OrderBy.Asc],
  );
}

async function setupPromoRedemptionsTable(tables: TablesDB): Promise<void> {
  await ensureTable(tables, APPWRITE_TABLE_PROMO_REDEMPTIONS_ID, 'Promo Redemptions');

  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_REDEMPTIONS_ID, 'promo_code_id', 64, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_REDEMPTIONS_ID, 'promo_code', 64, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_REDEMPTIONS_ID, 'user_id', 64, true);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_REDEMPTIONS_ID, 'reward_kind', 32, true);
  await ensureIntegerColumn(tables, APPWRITE_TABLE_PROMO_REDEMPTIONS_ID, 'reward_value', true, 0, 0, 100000000);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_REDEMPTIONS_ID, 'reward_currency', 8, false, 'try');
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_REDEMPTIONS_ID, 'checkout_mode', 32, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_REDEMPTIONS_ID, 'note', 255, false);
  await ensureStringColumn(tables, APPWRITE_TABLE_PROMO_REDEMPTIONS_ID, 'metadata_json', 10000, false);
  await ensureDatetimeColumn(tables, APPWRITE_TABLE_PROMO_REDEMPTIONS_ID, 'redeemed_at', true);

  await ensureIndex(
    tables,
    APPWRITE_TABLE_PROMO_REDEMPTIONS_ID,
    'promo_redemptions_code_idx',
    TablesDBIndexType.Key,
    ['promo_code_id'],
    [OrderBy.Asc],
  );

  await ensureIndex(
    tables,
    APPWRITE_TABLE_PROMO_REDEMPTIONS_ID,
    'promo_redemptions_user_idx',
    TablesDBIndexType.Key,
    ['user_id'],
    [OrderBy.Asc],
  );
}

async function ensureCoreResourcesOnce(): Promise<void> {
  const now = Date.now();
  if (coreEnsuredAt > 0 && now - coreEnsuredAt < ENSURE_TTL_MS) {
    return;
  }

  const client = createAdminClient();
  const tables = new TablesDB(client);
  const storage = new Storage(client);

  await runBootstrapStep('database', async () => ensureDatabase(tables));
  await runBootstrapStep('profiles', async () => setupProfilesTable(tables));
  await runBootstrapStep('gallery', async () => setupGalleryTable(tables));
  await runBootstrapStep('stripe_events', async () => setupStripeEventsTable(tables));
  await runBootstrapStep('billing_events', async () => setupBillingEventsTable(tables));
  await runBootstrapStep('analysis_history', async () => setupAnalysisHistoryTable(tables));
  await runBootstrapStep('analysis_file_cache', async () => setupAnalysisFileCacheTable(tables));
  await runBootstrapStep('memory_snippets', async () => setupMemorySnippetsTable(tables));
  await runBootstrapStep('mentor_chats', async () => setupMentorChatsTable(tables));
  await runBootstrapStep('mentor_messages', async () => setupMentorMessagesTable(tables));
  await runBootstrapStep('feedback', async () => setupFeedbackTable(tables));
  await runBootstrapStep('promo_codes', async () => setupPromoCodesTable(tables));
  await runBootstrapStep('promo_redemptions', async () => setupPromoRedemptionsTable(tables));
  await runBootstrapStep('feature_flags', async () => setupFeatureFlagsTable(tables));
  await runBootstrapStep('gallery_bucket', async () => ensureBucket(storage));

  coreEnsuredAt = Date.now();
}

async function ensureCommerceResourcesOnce(): Promise<void> {
  const now = Date.now();
  if (commerceEnsuredAt > 0 && now - commerceEnsuredAt < ENSURE_TTL_MS) {
    return;
  }

  const client = createAdminClient();
  const tables = new TablesDB(client);

  await runBootstrapStep('promo_codes', async () => setupPromoCodesTable(tables));
  await runBootstrapStep('promo_redemptions', async () => setupPromoRedemptionsTable(tables));

  commerceEnsuredAt = Date.now();
}

export async function ensureCoreAppwriteResources(): Promise<void> {
  if (coreEnsurePromise) {
    return coreEnsurePromise;
  }

  coreEnsurePromise = ensureCoreResourcesOnce().finally(() => {
    coreEnsurePromise = null;
  });

  return coreEnsurePromise;
}

export async function ensureCommerceAppwriteResources(): Promise<void> {
  await ensureCoreAppwriteResources();

  if (commerceEnsurePromise) {
    return commerceEnsurePromise;
  }

  commerceEnsurePromise = ensureCommerceResourcesOnce().finally(() => {
    commerceEnsurePromise = null;
  });

  return commerceEnsurePromise;
}
