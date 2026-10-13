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
import {
  collectAllRows,
  deleteAllRows,
  extractStorageFileId,
  type PrivacyDataPort,
} from '@/lib/privacy/data-port';
import { billingRetentionUntil, type DeletionStepDefinition, type DeletionStepResult } from '@/lib/privacy/deletion';

const MAX_ROWS_PER_TABLE = 20_000;

/** Rows whose columns point at files in the shared bucket. Collected before any row is removed. */
const FILE_REFERENCE_SOURCES: ReadonlyArray<{ tableId: string; ownerColumn: string; fileColumns: readonly string[] }> = [
  { tableId: APPWRITE_TABLE_ANALYSIS_HISTORY_ID, ownerColumn: 'user_id', fileColumns: ['preview_url', 'source_url'] },
  { tableId: APPWRITE_TABLE_GALLERY_ID, ownerColumn: 'user_id', fileColumns: ['storage_path', 'public_url'] },
  { tableId: APPWRITE_TABLE_MENTOR_MESSAGES_ID, ownerColumn: 'user_id', fileColumns: ['attachment_url'] },
  { tableId: APPWRITE_TABLE_CONFESSIONS_ID, ownerColumn: 'user_id', fileColumns: ['image_url'] },
  { tableId: APPWRITE_TABLE_PORTFOLIOS_ID, ownerColumn: 'user_id', fileColumns: ['cover_url'] },
];

function deletedOrNotApplicable(affectedCount: number): DeletionStepResult {
  return { status: 'done', outcome: affectedCount > 0 ? 'deleted' : 'not_applicable', affectedCount };
}

async function deleteTables(
  port: PrivacyDataPort,
  userId: string,
  targets: ReadonlyArray<{ tableId: string; column: string }>,
): Promise<number> {
  let total = 0;
  for (const target of targets) {
    total += await deleteAllRows(port, target.tableId, { column: target.column, value: userId }, MAX_ROWS_PER_TABLE);
  }
  return total;
}

/**
 * Production step registry. Order matters: files are resolved from rows first, the auth
 * account goes only after every data step, and the profile is swept again afterwards so a
 * profile re-created by a late client request cannot survive.
 */
export function createDefaultDeletionSteps(port: PrivacyDataPort): DeletionStepDefinition[] {
  const dataSteps = [
    'storage_files',
    'analysis_history',
    'gallery_submissions',
    'mentor_chats',
    'community_content',
    'referral_promo',
  ] as const;

  return [
    {
      id: 'storage_files',
      dependsOn: [],
      async run({ userId }) {
        const fileIds = new Set<string>();
        for (const source of FILE_REFERENCE_SOURCES) {
          const rows = await collectAllRows(
            port,
            source.tableId,
            { column: source.ownerColumn, value: userId },
            MAX_ROWS_PER_TABLE,
          );
          for (const row of rows) {
            for (const column of source.fileColumns) {
              const fileId = extractStorageFileId(row[column]);
              if (fileId) fileIds.add(fileId);
            }
          }
        }
        // Already-missing files count as resolved so re-runs converge.
        for (const fileId of fileIds) {
          await port.deleteFile(fileId);
        }
        return deletedOrNotApplicable(fileIds.size);
      },
    },
    {
      id: 'analysis_history',
      dependsOn: ['storage_files'],
      async run({ userId }) {
        return deletedOrNotApplicable(await deleteTables(port, userId, [
          { tableId: APPWRITE_TABLE_ANALYSIS_HISTORY_ID, column: 'user_id' },
          { tableId: APPWRITE_TABLE_ANALYSIS_FILE_CACHE_ID, column: 'user_id' },
        ]));
      },
    },
    {
      id: 'gallery_submissions',
      dependsOn: ['storage_files'],
      async run({ userId }) {
        return deletedOrNotApplicable(await deleteTables(port, userId, [
          { tableId: APPWRITE_TABLE_GALLERY_ID, column: 'user_id' },
        ]));
      },
    },
    {
      id: 'mentor_chats',
      dependsOn: ['storage_files'],
      async run({ userId }) {
        return deletedOrNotApplicable(await deleteTables(port, userId, [
          { tableId: APPWRITE_TABLE_MENTOR_MESSAGES_ID, column: 'user_id' },
          { tableId: APPWRITE_TABLE_MENTOR_CHATS_ID, column: 'user_id' },
          { tableId: APPWRITE_TABLE_MEMORY_SNIPPETS_ID, column: 'user_id' },
        ]));
      },
    },
    {
      id: 'community_content',
      dependsOn: ['storage_files'],
      async run({ userId }) {
        let total = 0;
        const openings = await collectAllRows(
          port,
          APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID,
          { column: 'owner_user_id', value: userId },
          MAX_ROWS_PER_TABLE,
        );
        // Reviews written by others on this user's openings describe the deleted submission; they go with it.
        for (const opening of openings) {
          total += await deleteAllRows(port, APPWRITE_TABLE_PEER_REVIEWS_ID, { column: 'opening_id', value: opening.$id });
        }
        total += await deleteTables(port, userId, [
          { tableId: APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID, column: 'owner_user_id' },
          { tableId: APPWRITE_TABLE_PEER_REVIEWS_ID, column: 'reviewer_user_id' },
          { tableId: APPWRITE_TABLE_CONFESSIONS_ID, column: 'user_id' },
          { tableId: APPWRITE_TABLE_PORTFOLIO_PAGES_ID, column: 'user_id' },
          { tableId: APPWRITE_TABLE_PORTFOLIOS_ID, column: 'user_id' },
          { tableId: APPWRITE_TABLE_FEEDBACK_ID, column: 'user_id' },
        ]);
        return deletedOrNotApplicable(total);
      },
    },
    {
      id: 'referral_promo',
      dependsOn: [],
      async run({ userId }) {
        // The user's own referral code lives on the profile row and goes with the profile step.
        return deletedOrNotApplicable(await deleteTables(port, userId, [
          { tableId: APPWRITE_TABLE_PROMO_REDEMPTIONS_ID, column: 'user_id' },
        ]));
      },
    },
    {
      id: 'billing_records',
      dependsOn: [],
      async run({ userId, now }) {
        const rows = await collectAllRows(
          port,
          APPWRITE_TABLE_BILLING_EVENTS_ID,
          { column: 'user_id', value: userId },
          MAX_ROWS_PER_TABLE,
        );
        if (rows.length === 0) return { status: 'done', outcome: 'not_applicable', affectedCount: 0 };
        return {
          status: 'done',
          outcome: 'retained_legal_hold',
          affectedCount: rows.length,
          retainedUntil: billingRetentionUntil(now),
        };
      },
    },
    {
      id: 'stripe_customer',
      dependsOn: [],
      async run({ stripeCustomerRef }) {
        if (!stripeCustomerRef) return { status: 'done', outcome: 'not_applicable', affectedCount: 0 };
        // Cancelling subscriptions and redacting a Stripe customer is irreversible and billing-relevant;
        // the owner performs it in the Stripe dashboard and records the receipt.
        return { status: 'manual_required', reasonCode: 'stripe_customer_redaction_requires_owner' };
      },
    },
    {
      id: 'profile',
      dependsOn: [...dataSteps],
      async run({ userId }) {
        return deletedOrNotApplicable(await deleteProfileRows(port, userId));
      },
    },
    {
      id: 'auth_account',
      dependsOn: [...dataSteps, 'billing_records', 'profile'],
      async run({ userId }) {
        const outcome = await port.deleteAuthUser(userId);
        await deleteProfileRows(port, userId);
        return { status: 'done', outcome: outcome === 'deleted' ? 'deleted' : 'not_applicable', affectedCount: 1 };
      },
    },
  ];
}

async function deleteProfileRows(port: PrivacyDataPort, userId: string): Promise<number> {
  let deleted = await deleteAllRows(port, APPWRITE_TABLE_PROFILES_ID, { column: 'user_id', value: userId });
  // Legacy profiles used the auth user id as the row id.
  if ((await port.deleteRow(APPWRITE_TABLE_PROFILES_ID, userId)) === 'deleted') deleted += 1;
  return deleted;
}
