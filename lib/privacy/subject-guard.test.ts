/** @jest-environment node */
import { InMemoryDeletionStore } from '@/lib/privacy/__testing__/fake-privacy-port';
import { createDeletionRequest } from '@/lib/privacy/deletion';
import { checkSubjectAllowed, resetSubjectGuardCache } from '@/lib/privacy/subject-guard';

jest.mock('@/lib/privacy/deletion-store', () => ({
  createAppwriteDeletionStore: () => {
    throw new Error('tests pass an explicit store');
  },
}));
jest.mock('@/lib/logger', () => ({ logServerError: jest.fn(), logServerInfo: jest.fn() }));

describe('checkSubjectAllowed', () => {
  let store: InMemoryDeletionStore;

  beforeEach(() => {
    resetSubjectGuardCache();
    store = new InMemoryDeletionStore();
  });

  it('allows a subject without a deletion request', async () => {
    await expect(checkSubjectAllowed('user_a', 'ai_processing', 'en', store)).resolves.toBeNull();
  });

  it.each(['ai_processing', 'new_uploads', 'account'] as const)('denies %s once a tombstone exists', async (scope) => {
    await store.save(createDeletionRequest('user_a', null, new Date()));

    const denial = await checkSubjectAllowed('user_a', scope, 'en', store);

    expect(denial).toEqual({ status: 410, body: expect.objectContaining({ code: 'ACCOUNT_DELETION_REQUESTED' }) });
    await expect(checkSubjectAllowed('user_b', scope, 'en', store)).resolves.toBeNull();
  });

  it('honours the scopes recorded in the tombstone', async () => {
    const record = createDeletionRequest('user_a', null, new Date());
    record.tombstone.denyScopes = ['ai_processing'];
    await store.save(record);

    await expect(checkSubjectAllowed('user_a', 'new_uploads', 'en', store)).resolves.toBeNull();
    await expect(checkSubjectAllowed('user_a', 'ai_processing', 'en', store)).resolves.toMatchObject({ status: 410 });
  });

  it('fails closed when the deletion store cannot be read', async () => {
    jest.spyOn(store, 'get').mockRejectedValue(new Error('appwrite down'));

    const denial = await checkSubjectAllowed('user_a', 'new_uploads', 'en', store);

    expect(denial).toEqual({ status: 503, body: expect.objectContaining({ code: 'PRIVACY_CHECK_UNAVAILABLE' }) });
  });

  it('caches denials but never allowances', async () => {
    const get = jest.spyOn(store, 'get');
    await checkSubjectAllowed('user_a', 'ai_processing', 'en', store);
    await checkSubjectAllowed('user_a', 'ai_processing', 'en', store);
    expect(get).toHaveBeenCalledTimes(2);

    await store.save(createDeletionRequest('user_a', null, new Date()));
    await checkSubjectAllowed('user_a', 'ai_processing', 'en', store);
    await checkSubjectAllowed('user_a', 'ai_processing', 'en', store);
    expect(get).toHaveBeenCalledTimes(3);
  });
});
