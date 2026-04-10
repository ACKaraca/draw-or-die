import {
  Client,
  OrderBy,
  Permission,
  Role,
  Storage,
  TablesDB,
  TablesDBIndexType,
} from 'node-appwrite';

// Validate Appwrite endpoint is a safe https URL (prevents SSRF)
function validateAppwriteEndpoint(raw) {
  const DEFAULT_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
  if (!raw) return DEFAULT_ENDPOINT;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') {
      console.error('APPWRITE_ENDPOINT must use https protocol.');
      process.exit(1);
    }
    return parsed.href.replace(/\/$/, '');
  } catch {
    console.error('APPWRITE_ENDPOINT is not a valid URL.');
    process.exit(1);
  }
}

const endpoint = validateAppwriteEndpoint(process.env.APPWRITE_ENDPOINT);
const projectId = process.env.APPWRITE_PROJECT_ID ?? 'draw-or-die';
const apiKey = (() => {
  const raw = process.env.APPWRITE_API_KEY;
  if (typeof raw !== 'string') {
    throw new Error('APPWRITE_API_KEY is required.');
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('APPWRITE_API_KEY is required.');
  }
  return trimmed;
})();

const IDS = {
  database: process.env.APPWRITE_DATABASE_ID ?? 'draw_or_die',
  profilesTable: process.env.APPWRITE_TABLE_PROFILES_ID ?? 'profiles',
  galleryTable: process.env.APPWRITE_TABLE_GALLERY_ID ?? 'gallery_submissions',
  stripeEventsTable: process.env.APPWRITE_TABLE_STRIPE_EVENTS_ID ?? 'stripe_events',
  analysisHistoryTable: process.env.APPWRITE_TABLE_ANALYSIS_HISTORY_ID ?? 'analysis_history',
  mentorChatsTable: process.env.APPWRITE_TABLE_MENTOR_CHATS_ID ?? 'mentor_chats',
  mentorMessagesTable: process.env.APPWRITE_TABLE_MENTOR_MESSAGES_ID ?? 'mentor_messages',
  feedbackTable: process.env.APPWRITE_TABLE_FEEDBACK_ID ?? 'feedback_entries',
  promoCodesTable: process.env.APPWRITE_TABLE_PROMO_CODES_ID ?? 'promo_codes',
  promoRedemptionsTable: process.env.APPWRITE_TABLE_PROMO_REDEMPTIONS_ID ?? 'promo_redemptions',
  galleryBucket: process.env.APPWRITE_BUCKET_GALLERY_ID ?? 'gallery',
};

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const tables = new TablesDB(client);
const storage = new Storage(client);

function isNotFound(error) {
  return error && (error.code === 404 || error.type === 'general_not_found');
}

async function ensureDatabase() {
  try {
    await tables.get({ databaseId: IDS.database });
    console.log(`Database exists: ${IDS.database}`);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await tables.create({ databaseId: IDS.database, name: 'Draw or Die', enabled: true });
    console.log(`Database created: ${IDS.database}`);
  }
}

async function ensureTable(tableId, name) {
  try {
    await tables.getTable({ databaseId: IDS.database, tableId });
    console.log(`Table exists: ${tableId}`);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await tables.createTable({
      databaseId: IDS.database,
      tableId,
      name,
      rowSecurity: false,
      enabled: true,
    });
    console.log(`Table created: ${tableId}`);
  }
}

async function ensureStringColumn(tableId, key, size, required, defaultValue = undefined, array = false, encrypt = false) {
  try {
    await tables.getColumn({ databaseId: IDS.database, tableId, key });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    const payload = {
      databaseId: IDS.database,
      tableId,
      key,
      size,
      required,
      array,
      encrypt,
      ...(required || defaultValue === undefined ? {} : { default: defaultValue }),
    };

    await tables.createStringColumn(payload);
    console.log(`Column created: ${tableId}.${key}`);
  }
}

async function ensureBooleanColumn(tableId, key, required, defaultValue = undefined, array = false) {
  try {
    await tables.getColumn({ databaseId: IDS.database, tableId, key });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    const payload = {
      databaseId: IDS.database,
      tableId,
      key,
      required,
      array,
      ...(required || defaultValue === undefined ? {} : { default: defaultValue }),
    };

    await tables.createBooleanColumn(payload);
    console.log(`Column created: ${tableId}.${key}`);
  }
}

async function ensureIntegerColumn(tableId, key, required, defaultValue = undefined, min = undefined, max = undefined, array = false) {
  try {
    await tables.getColumn({ databaseId: IDS.database, tableId, key });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    const payload = {
      databaseId: IDS.database,
      tableId,
      key,
      required,
      min,
      max,
      array,
      ...(required || defaultValue === undefined ? {} : { default: defaultValue }),
    };

    await tables.createIntegerColumn(payload);
    console.log(`Column created: ${tableId}.${key}`);
  }
}

async function ensureDatetimeColumn(tableId, key, required, defaultValue = undefined, array = false) {
  try {
    await tables.getColumn({ databaseId: IDS.database, tableId, key });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    const payload = {
      databaseId: IDS.database,
      tableId,
      key,
      required,
      array,
      ...(required || defaultValue === undefined ? {} : { default: defaultValue }),
    };

    await tables.createDatetimeColumn(payload);
    console.log(`Column created: ${tableId}.${key}`);
  }
}

async function ensureIndex(tableId, key, type, columns, orders = undefined) {
  try {
    await tables.getIndex({ databaseId: IDS.database, tableId, key });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await tables.createIndex({
      databaseId: IDS.database,
      tableId,
      key,
      type,
      columns,
      orders,
    });
    console.log(`Index created: ${tableId}.${key}`);
  }
}

async function ensureBucket() {
  try {
    await storage.getBucket({ bucketId: IDS.galleryBucket });
    console.log(`Bucket exists: ${IDS.galleryBucket}`);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await storage.createBucket({
      bucketId: IDS.galleryBucket,
      name: 'Gallery',
      permissions: [
        Permission.read(Role.any()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ],
      fileSecurity: false,
      enabled: true,
      maximumFileSize: 35 * 1024 * 1024,
      allowedFileExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
      compression: 'gzip',
      encryption: true,
      antivirus: true,
    });
    console.log(`Bucket created: ${IDS.galleryBucket}`);
  }
}

async function setupProfilesTable() {
  const tableId = IDS.profilesTable;
  await ensureTable(tableId, 'Profiles');

  await ensureStringColumn(tableId, 'email', 255, false);
  await ensureBooleanColumn(tableId, 'is_premium', true, false);
  await ensureIntegerColumn(tableId, 'rapido_pens', true, 15, 0, 1000000);
  await ensureIntegerColumn(tableId, 'rapido_fraction_cents', true, 0, 0, 99);
  await ensureIntegerColumn(tableId, 'progression_score', true, 0, 0, 1000000);
  await ensureIntegerColumn(tableId, 'wall_of_death_count', true, 0, 0, 1000000);
  await ensureStringColumn(tableId, 'earned_badges', 10000, true, '[]');
  await ensureStringColumn(tableId, 'stripe_customer_id', 255, false);
  await ensureStringColumn(tableId, 'stripe_subscription_id', 255, false);
  await ensureBooleanColumn(tableId, 'edu_verified', true, false);
  await ensureStringColumn(tableId, 'edu_email', 255, false);
  await ensureStringColumn(tableId, 'edu_verification_code', 16, false);
  await ensureStringColumn(tableId, 'edu_verification_email', 255, false);
  await ensureDatetimeColumn(tableId, 'edu_verification_expires', false);

  await ensureIndex(
    tableId,
    'profiles_subscription_idx',
    TablesDBIndexType.Key,
    ['stripe_subscription_id'],
    [OrderBy.Asc],
  );
}

async function setupGalleryTable() {
  const tableId = IDS.galleryTable;
  await ensureTable(tableId, 'Gallery Submissions');

  await ensureStringColumn(tableId, 'user_id', 64, true);
  await ensureStringColumn(tableId, 'title', 255, true);
  await ensureStringColumn(tableId, 'jury_quote', 8000, true);
  await ensureStringColumn(tableId, 'gallery_type', 32, true);
  await ensureStringColumn(tableId, 'status', 32, true, 'pending');
  await ensureStringColumn(tableId, 'public_url', 2048, false);
  await ensureStringColumn(tableId, 'storage_path', 255, false);

  await ensureIndex(
    tableId,
    'gallery_status_idx',
    TablesDBIndexType.Key,
    ['status'],
    [OrderBy.Asc],
  );

  await ensureIndex(
    tableId,
    'gallery_type_idx',
    TablesDBIndexType.Key,
    ['gallery_type'],
    [OrderBy.Asc],
  );
}

async function setupStripeEventsTable() {
  const tableId = IDS.stripeEventsTable;
  await ensureTable(tableId, 'Stripe Events');

  await ensureStringColumn(tableId, 'event_id', 128, true);
  await ensureDatetimeColumn(tableId, 'processed_at', true);

  await ensureIndex(
    tableId,
    'stripe_event_unique',
    TablesDBIndexType.Unique,
    ['event_id'],
    [OrderBy.Asc],
  );
}

async function setupAnalysisHistoryTable() {
  const tableId = IDS.analysisHistoryTable;
  await ensureTable(tableId, 'Analysis History');

  await ensureStringColumn(tableId, 'user_id', 64, true);
  await ensureStringColumn(tableId, 'title', 255, true);
  await ensureStringColumn(tableId, 'critique', 10000, true);
  await ensureIntegerColumn(tableId, 'score', false, undefined, 0, 100);
  await ensureStringColumn(tableId, 'gallery_type', 32, true, 'NONE');
  await ensureStringColumn(tableId, 'preview_url', 2048, true);

  await ensureIndex(
    tableId,
    'analysis_user_idx',
    TablesDBIndexType.Key,
    ['user_id'],
    [OrderBy.Asc],
  );
}

async function setupMentorChatsTable() {
  const tableId = IDS.mentorChatsTable;
  await ensureTable(tableId, 'Mentor Chats');

  await ensureStringColumn(tableId, 'user_id', 64, true);
  await ensureStringColumn(tableId, 'title', 255, true);
  await ensureStringColumn(tableId, 'month_key', 16, true);
  await ensureIntegerColumn(tableId, 'token_limit', true, 8000, 1, 200000);
  await ensureIntegerColumn(tableId, 'tokens_used', true, 0, 0, 200000);
  await ensureBooleanColumn(tableId, 'is_premium_chat', true, false);
  await ensureStringColumn(tableId, 'status', 32, true, 'active');
  await ensureDatetimeColumn(tableId, 'last_message_at', false);

  await ensureIndex(
    tableId,
    'mentor_chats_user_idx',
    TablesDBIndexType.Key,
    ['user_id'],
    [OrderBy.Asc],
  );

  await ensureIndex(
    tableId,
    'mentor_chats_month_idx',
    TablesDBIndexType.Key,
    ['user_id', 'month_key'],
    [OrderBy.Asc, OrderBy.Asc],
  );
}

async function setupMentorMessagesTable() {
  const tableId = IDS.mentorMessagesTable;
  await ensureTable(tableId, 'Mentor Messages');

  await ensureStringColumn(tableId, 'chat_id', 64, true);
  await ensureStringColumn(tableId, 'user_id', 64, true);
  await ensureStringColumn(tableId, 'role', 16, true);
  await ensureStringColumn(tableId, 'content', 12000, true);
  await ensureIntegerColumn(tableId, 'tokens', true, 0, 0, 200000);
  await ensureStringColumn(tableId, 'attachment_name', 255, false);
  await ensureStringColumn(tableId, 'attachment_url', 2048, false);
  await ensureStringColumn(tableId, 'attachment_mime', 64, false);

  await ensureIndex(
    tableId,
    'mentor_messages_chat_idx',
    TablesDBIndexType.Key,
    ['chat_id'],
    [OrderBy.Asc],
  );
}

async function setupFeedbackTable() {
  const tableId = IDS.feedbackTable;
  await ensureTable(tableId, 'Feedback Entries');

  await ensureStringColumn(tableId, 'user_id', 64, false);
  await ensureStringColumn(tableId, 'email', 255, false);
  await ensureStringColumn(tableId, 'category', 32, true, 'general');
  await ensureStringColumn(tableId, 'message', 6000, true);
  await ensureStringColumn(tableId, 'source_path', 255, false);
  await ensureIntegerColumn(tableId, 'rating', false, undefined, 1, 5);
  await ensureStringColumn(tableId, 'status', 32, true, 'new');
  await ensureStringColumn(tableId, 'meta_json', 8000, false);

  await ensureIndex(
    tableId,
    'feedback_status_idx',
    TablesDBIndexType.Key,
    ['status'],
    [OrderBy.Asc],
  );

  await ensureIndex(
    tableId,
    'feedback_user_idx',
    TablesDBIndexType.Key,
    ['user_id'],
    [OrderBy.Asc],
  );
}

async function setupPromoCodesTable() {
  const tableId = IDS.promoCodesTable;
  await ensureTable(tableId, 'Promo Codes');

  await ensureStringColumn(tableId, 'code', 64, true);
  await ensureStringColumn(tableId, 'title', 255, true);
  await ensureStringColumn(tableId, 'description', 6000, false);
  await ensureBooleanColumn(tableId, 'active', true, false);
  await ensureStringColumn(tableId, 'reward_kind', 32, true, 'rapido');
  await ensureIntegerColumn(tableId, 'reward_value', true, 0, 0, 100000000);
  await ensureStringColumn(tableId, 'reward_currency', 8, false, 'try');
  await ensureStringColumn(tableId, 'reward_interval', 16, false);
  await ensureStringColumn(tableId, 'checkout_modes', 128, false);
  await ensureStringColumn(tableId, 'target_scope', 64, false, 'any');
  await ensureIntegerColumn(tableId, 'max_total_uses', false, undefined, 1, 1000000);
  await ensureIntegerColumn(tableId, 'max_uses_per_user', false, undefined, 1, 1000000);
  await ensureIntegerColumn(tableId, 'used_count', true, 0, 0, 1000000);
  await ensureDatetimeColumn(tableId, 'starts_at', false);
  await ensureDatetimeColumn(tableId, 'ends_at', false);
  await ensureIntegerColumn(tableId, 'min_rapido_purchase', false, undefined, 1, 1000000);
  await ensureStringColumn(tableId, 'metadata_json', 10000, false);

  await ensureIndex(
    tableId,
    'promo_codes_code_idx',
    TablesDBIndexType.Unique,
    ['code'],
    [OrderBy.Asc],
  );
}

async function setupPromoRedemptionsTable() {
  const tableId = IDS.promoRedemptionsTable;
  await ensureTable(tableId, 'Promo Redemptions');

  await ensureStringColumn(tableId, 'promo_code_id', 64, true);
  await ensureStringColumn(tableId, 'promo_code', 64, true);
  await ensureStringColumn(tableId, 'user_id', 64, true);
  await ensureStringColumn(tableId, 'reward_kind', 32, true);
  await ensureIntegerColumn(tableId, 'reward_value', true, 0, 0, 100000000);
  await ensureStringColumn(tableId, 'reward_currency', 8, false, 'try');
  await ensureStringColumn(tableId, 'checkout_mode', 32, false);
  await ensureStringColumn(tableId, 'note', 255, false);
  await ensureStringColumn(tableId, 'metadata_json', 10000, false);
  await ensureDatetimeColumn(tableId, 'redeemed_at', true);

  await ensureIndex(
    tableId,
    'promo_redemptions_code_idx',
    TablesDBIndexType.Key,
    ['promo_code_id'],
    [OrderBy.Asc],
  );

  await ensureIndex(
    tableId,
    'promo_redemptions_user_idx',
    TablesDBIndexType.Key,
    ['user_id'],
    [OrderBy.Asc],
  );
}

async function main() {
  console.log('Setting up Appwrite resources...');
  await ensureDatabase();
  await setupProfilesTable();
  await setupGalleryTable();
  await setupStripeEventsTable();
  await setupAnalysisHistoryTable();
  await setupMentorChatsTable();
  await setupMentorMessagesTable();
  await setupFeedbackTable();
  await setupPromoCodesTable();
  await setupPromoRedemptionsTable();
  await ensureBucket();
  console.log('Appwrite resource setup completed.');
}

main().catch((error) => {
  console.error('Resource setup failed:', error);
  process.exit(1);
});
