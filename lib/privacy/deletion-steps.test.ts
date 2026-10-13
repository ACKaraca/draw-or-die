import {
  APPWRITE_BUCKET_GALLERY_ID,
  APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
  APPWRITE_TABLE_BILLING_EVENTS_ID,
  APPWRITE_TABLE_GALLERY_ID,
  APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
  APPWRITE_TABLE_MENTOR_CHATS_ID,
  APPWRITE_TABLE_MENTOR_MESSAGES_ID,
  APPWRITE_TABLE_PEER_REVIEWS_ID,
  APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID,
  APPWRITE_TABLE_PROFILES_ID,
  APPWRITE_TABLE_PROMO_REDEMPTIONS_ID,
} from '@/lib/appwrite/server';
import { extractStorageFileId } from '@/lib/privacy/data-port';
import { runDeletion } from '@/lib/privacy/deletion';
import { createDefaultDeletionSteps } from '@/lib/privacy/deletion-steps';
import { FakePrivacyPort, InMemoryDeletionStore } from '@/lib/privacy/__testing__/fake-privacy-port';

// node-appwrite ships ESM that Jest cannot parse; these tests only need the table-id constants.
jest.mock('node-appwrite', () => ({}));

jest.mock('@/lib/logger', () => ({
  logServerError: jest.fn(),
  logServerInfo: jest.fn(),
}));

const USER = 'user_a';
const OTHER = 'user_b';

function fileUrl(fileId: string): string {
  return `https://fra.cloud.appwrite.io/v1/storage/buckets/${APPWRITE_BUCKET_GALLERY_ID}/files/${fileId}/view?project=draw-or-die`;
}

function seedWorld(): FakePrivacyPort {
  const port = new FakePrivacyPort();
  port.authUsers.add(USER);
  port.authUsers.add(OTHER);
  ['f_hist_a', 'f_src_a', 'f_gal_a', 'f_att_a', 'f_hist_b'].forEach((id) => port.files.add(id));

  port.seed(APPWRITE_TABLE_PROFILES_ID, [
    { $id: 'p_a', user_id: USER, stripe_customer_id: 'cus_a' },
    { $id: 'p_b', user_id: OTHER },
  ]);
  port.seed(APPWRITE_TABLE_ANALYSIS_HISTORY_ID, [
    { $id: 'h1', user_id: USER, preview_url: fileUrl('f_hist_a'), source_url: fileUrl('f_src_a') },
    { $id: 'h2', user_id: OTHER, preview_url: fileUrl('f_hist_b') },
  ]);
  port.seed(APPWRITE_TABLE_GALLERY_ID, [{ $id: 'g1', user_id: USER, storage_path: 'f_gal_a' }]);
  port.seed(APPWRITE_TABLE_MENTOR_CHATS_ID, [{ $id: 'c1', user_id: USER }]);
  port.seed(APPWRITE_TABLE_MENTOR_MESSAGES_ID, [{ $id: 'm1', user_id: USER, attachment_url: fileUrl('f_att_a') }]);
  port.seed(APPWRITE_TABLE_MEMORY_SNIPPETS_ID, [
    { $id: 's1', user_id: USER, visible_to_user: false },
    { $id: 's2', user_id: OTHER, visible_to_user: true },
  ]);
  port.seed(APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID, [{ $id: 'o1', owner_user_id: USER }]);
  port.seed(APPWRITE_TABLE_PEER_REVIEWS_ID, [
    { $id: 'r1', opening_id: 'o1', reviewer_user_id: OTHER },
    { $id: 'r2', opening_id: 'o9', reviewer_user_id: USER },
    { $id: 'r3', opening_id: 'o9', reviewer_user_id: OTHER },
  ]);
  port.seed(APPWRITE_TABLE_PROMO_REDEMPTIONS_ID, [{ $id: 'pr1', user_id: USER }]);
  port.seed(APPWRITE_TABLE_BILLING_EVENTS_ID, [{ $id: 'b1', user_id: USER }]);
  return port;
}

function idsOf(port: FakePrivacyPort, tableId: string): string[] {
  return port.rowsOf(tableId).map((row) => row.$id);
}

describe('default deletion steps (in-memory, no live data)', () => {
  it('deletes only the subject’s data, retains billing under legal hold and waits on the Stripe owner step', async () => {
    const port = seedWorld();
    const store = new InMemoryDeletionStore();

    const record = await runDeletion({
      userId: USER,
      stripeCustomerRef: 'cus_a',
      store,
      steps: createDefaultDeletionSteps(port),
      now: () => new Date('2026-10-13T00:00:00.000Z'),
    });

    expect(record.status).toBe('blocked');
    expect(record.steps.stripe_customer.status).toBe('manual_required');
    expect(record.steps.billing_records).toMatchObject({
      status: 'done',
      outcome: 'retained_legal_hold',
      retainedUntil: '2036-10-13T00:00:00.000Z',
    });
    expect(idsOf(port, APPWRITE_TABLE_BILLING_EVENTS_ID)).toEqual(['b1']);

    expect([...port.files].sort()).toEqual(['f_hist_b']);
    expect(idsOf(port, APPWRITE_TABLE_PROFILES_ID)).toEqual(['p_b']);
    expect(idsOf(port, APPWRITE_TABLE_ANALYSIS_HISTORY_ID)).toEqual(['h2']);
    expect(idsOf(port, APPWRITE_TABLE_GALLERY_ID)).toEqual([]);
    expect(idsOf(port, APPWRITE_TABLE_MENTOR_CHATS_ID)).toEqual([]);
    expect(idsOf(port, APPWRITE_TABLE_MENTOR_MESSAGES_ID)).toEqual([]);
    expect(idsOf(port, APPWRITE_TABLE_MEMORY_SNIPPETS_ID)).toEqual(['s2']);
    expect(idsOf(port, APPWRITE_TABLE_PEER_REVIEW_OPENINGS_ID)).toEqual([]);
    expect(idsOf(port, APPWRITE_TABLE_PEER_REVIEWS_ID)).toEqual(['r3']);
    expect(idsOf(port, APPWRITE_TABLE_PROMO_REDEMPTIONS_ID)).toEqual([]);
    expect([...port.authUsers]).toEqual([OTHER]);
  });

  it('keeps rows (and their file references) when file deletion fails, then converges on retry', async () => {
    const port = seedWorld();
    const store = new InMemoryDeletionStore();
    port.failures.deleteFile = () => {
      throw new Error('storage unavailable');
    };

    const failed = await runDeletion({ userId: USER, stripeCustomerRef: null, store, steps: createDefaultDeletionSteps(port) });

    expect(failed.status).toBe('partial');
    expect(failed.steps.storage_files.status).toBe('failed');
    expect(failed.steps.analysis_history.status).toBe('blocked');
    expect(failed.steps.auth_account.status).toBe('blocked');
    expect(idsOf(port, APPWRITE_TABLE_ANALYSIS_HISTORY_ID)).toContain('h1');
    expect(port.authUsers.has(USER)).toBe(true);

    port.failures.deleteFile = undefined;
    const retried = await runDeletion({ userId: USER, stripeCustomerRef: null, store, steps: createDefaultDeletionSteps(port) });

    expect(retried.status).toBe('completed');
    expect(port.files.has('f_hist_a')).toBe(false);
    expect(port.authUsers.has(USER)).toBe(false);
  });

  it('reports partial when the auth account cannot be deleted and does not claim completion', async () => {
    const port = seedWorld();
    const store = new InMemoryDeletionStore();
    port.failures.deleteAuthUser = () => {
      throw new Error('users api down');
    };

    const record = await runDeletion({ userId: USER, stripeCustomerRef: null, store, steps: createDefaultDeletionSteps(port) });

    expect(record.status).toBe('partial');
    expect(record.steps.profile.status).toBe('done');
    expect(record.steps.auth_account.status).toBe('failed');
  });

  it('sweeps a profile re-created after the profile step when the auth account step runs', async () => {
    const port = seedWorld();
    const store = new InMemoryDeletionStore();
    let isFirstAttempt = true;
    port.failures.deleteAuthUser = () => {
      if (isFirstAttempt) {
        isFirstAttempt = false;
        throw new Error('transient');
      }
    };

    await runDeletion({ userId: USER, stripeCustomerRef: null, store, steps: createDefaultDeletionSteps(port) });
    port.seed(APPWRITE_TABLE_PROFILES_ID, [{ $id: 'p_a_recreated', user_id: USER }]);
    const record = await runDeletion({ userId: USER, stripeCustomerRef: null, store, steps: createDefaultDeletionSteps(port) });

    expect(record.status).toBe('completed');
    expect(idsOf(port, APPWRITE_TABLE_PROFILES_ID)).toEqual(['p_b']);
  });
});

describe('extractStorageFileId', () => {
  it('accepts bare ids and bucket URLs and rejects foreign URLs', () => {
    expect(extractStorageFileId('abc123')).toBe('abc123');
    expect(extractStorageFileId(fileUrl('xyz'))).toBe('xyz');
    expect(extractStorageFileId('https://example.com/storage/buckets/other/files/xyz/view')).toBeNull();
    expect(extractStorageFileId('../etc/passwd')).toBeNull();
    expect(extractStorageFileId(undefined)).toBeNull();
  });
});
