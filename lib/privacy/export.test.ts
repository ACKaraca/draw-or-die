import {
  APPWRITE_TABLE_BILLING_EVENTS_ID,
  APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
  APPWRITE_TABLE_PROFILES_ID,
} from '@/lib/appwrite/server';
import { PrivacyLimitExceededError } from '@/lib/privacy/data-port';
import { EXPORT_DATA_CLASSES, EXPORT_FORMAT_VERSION, buildAccountExport } from '@/lib/privacy/export';
import { FakePrivacyPort } from '@/lib/privacy/__testing__/fake-privacy-port';

// node-appwrite ships ESM that Jest cannot parse; these tests only need the table-id constants.
jest.mock('node-appwrite', () => ({}));

const USER = { id: 'user_a', email: 'a@example.com', name: 'A', createdAt: '2026-01-01T00:00:00.000Z' };

describe('buildAccountExport', () => {
  it('returns only the requesting user’s documented data and strips secrets/internal fields', async () => {
    const port = new FakePrivacyPort();
    port.seed(APPWRITE_TABLE_PROFILES_ID, [
      {
        $id: 'p_a',
        user_id: 'user_a',
        email: 'a@example.com',
        rapido_pens: 12,
        edu_verification_code: '123456',
        stripe_customer_id: 'cus_secret',
        stripe_subscription_id: 'sub_secret',
      },
      { $id: 'p_b', user_id: 'user_b', email: 'b@example.com' },
    ]);
    port.seed(APPWRITE_TABLE_MEMORY_SNIPPETS_ID, [
      { $id: 's1', user_id: 'user_a', category: 'hidden_style', snippet: 'brutalist', visible_to_user: false },
    ]);
    port.seed(APPWRITE_TABLE_BILLING_EVENTS_ID, [
      { $id: 'b1', user_id: 'user_a', event_type: 'rapido_pack', amount_cents: 500, metadata_json: '{"internal":true}' },
    ]);

    const exported = await buildAccountExport({ port, user: USER, now: new Date('2026-10-13T00:00:00.000Z') });
    const serialized = JSON.stringify(exported);

    expect(exported.formatVersion).toBe(EXPORT_FORMAT_VERSION);
    expect(exported.account).toEqual(USER);
    expect(exported.data.profile).toEqual([
      expect.objectContaining({ id: 'p_a', email: 'a@example.com', rapido_pens: 12 }),
    ]);
    expect(exported.data.aiMemory).toEqual([expect.objectContaining({ snippet: 'brutalist', visible_to_user: false })]);
    expect(exported.data.billingEvents[0]).not.toHaveProperty('metadata_json');
    expect(serialized).not.toContain('b@example.com');
    expect(serialized).not.toContain('123456');
    expect(serialized).not.toContain('cus_secret');
    expect(serialized).not.toContain('sub_secret');
    expect(exported.manifest).toHaveLength(EXPORT_DATA_CLASSES.length);
    expect(exported.manifest.find((entry) => entry.dataClass === 'profile')?.count).toBe(1);
  });

  it('fails loudly instead of silently truncating an oversized class', async () => {
    const port = new FakePrivacyPort();
    port.seed(
      APPWRITE_TABLE_BILLING_EVENTS_ID,
      Array.from({ length: 5_101 }, (_, index) => ({ $id: `b${String(index).padStart(5, '0')}`, user_id: 'user_a' })),
    );

    await expect(buildAccountExport({ port, user: USER })).rejects.toBeInstanceOf(PrivacyLimitExceededError);
  });
});
