import {
  DELETION_CONTRACT_VERSION,
  DELETION_DENY_SCOPES,
  DELETION_STEP_IDS,
  DeletionRegistryError,
  computeSubjectHash,
  deriveRequestStatus,
  isSubjectDenied,
  recordManualStepCompletion,
  runDeletion,
  toDeletionReceipt,
  type DeletionStepDefinition,
  type DeletionStepId,
  type DeletionStepResult,
} from '@/lib/privacy/deletion';
import { InMemoryDeletionStore } from '@/lib/privacy/__testing__/fake-privacy-port';

jest.mock('@/lib/logger', () => ({
  logServerError: jest.fn(),
  logServerInfo: jest.fn(),
}));

const USER_ID = 'user_123';
const FIXED_NOW = new Date('2026-10-13T10:00:00.000Z');

const DEPENDS_ON: Record<DeletionStepId, DeletionStepId[]> = {
  storage_files: [],
  analysis_history: ['storage_files'],
  gallery_submissions: ['storage_files'],
  mentor_chats: ['storage_files'],
  community_content: ['storage_files'],
  referral_promo: [],
  billing_records: [],
  stripe_customer: [],
  profile: ['storage_files', 'analysis_history', 'gallery_submissions', 'mentor_chats', 'community_content', 'referral_promo'],
  auth_account: [
    'storage_files', 'analysis_history', 'gallery_submissions', 'mentor_chats', 'community_content', 'referral_promo',
    'billing_records', 'profile',
  ],
};

type Behaviour = 'ok' | 'throw' | 'fail' | 'manual';

function buildSteps(behaviour: Partial<Record<DeletionStepId, Behaviour>> = {}) {
  const calls: DeletionStepId[] = [];
  const steps: DeletionStepDefinition[] = DELETION_STEP_IDS.map((id) => ({
    id,
    dependsOn: DEPENDS_ON[id],
    async run(): Promise<DeletionStepResult> {
      calls.push(id);
      switch (behaviour[id] ?? 'ok') {
        case 'throw':
          throw new Error(`boom in ${id}`);
        case 'fail':
          return { status: 'failed', reasonCode: 'injected_failure' };
        case 'manual':
          return { status: 'manual_required', reasonCode: 'needs_owner' };
        default:
          return { status: 'done', outcome: 'deleted', affectedCount: 1 };
      }
    },
  }));
  return { steps, calls };
}

function dependentsOf(stepId: DeletionStepId): DeletionStepId[] {
  const result = new Set<DeletionStepId>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of DELETION_STEP_IDS) {
      if (result.has(id)) continue;
      if (DEPENDS_ON[id].some((dependency) => dependency === stepId || result.has(dependency))) {
        result.add(id);
        changed = true;
      }
    }
  }
  return [...result];
}

describe('runDeletion', () => {
  it('completes when every required subsystem reports done and writes a versioned tombstone', async () => {
    const store = new InMemoryDeletionStore();
    const { steps, calls } = buildSteps();

    const record = await runDeletion({ userId: USER_ID, stripeCustomerRef: null, store, steps, now: () => FIXED_NOW });

    expect(record.status).toBe('completed');
    expect(record.completedAt).toBe(FIXED_NOW.toISOString());
    expect(calls).toEqual([...DELETION_STEP_IDS]);
    expect(record.contractVersion).toBe(DELETION_CONTRACT_VERSION);
    expect(record.tombstone).toMatchObject({
      contractVersion: DELETION_CONTRACT_VERSION,
      subjectHash: computeSubjectHash(USER_ID),
      denyScopes: [...DELETION_DENY_SCOPES],
    });
    for (const exception of record.tombstone.retentionExceptions) {
      expect(Date.parse(exception.retainUntil)).toBeGreaterThan(FIXED_NOW.getTime());
    }
    expect(JSON.stringify(record)).not.toContain(USER_ID);
  });

  it('persists the tombstone before the first destructive step runs', async () => {
    const store = new InMemoryDeletionStore();
    const { steps } = buildSteps();
    const firstStep = steps[0]!;
    const originalRun = firstStep.run;
    let tombstoneSeenFirst = false;
    firstStep.run = async (context) => {
      const persisted = await store.get(computeSubjectHash(USER_ID));
      tombstoneSeenFirst = persisted?.tombstone.contractVersion === DELETION_CONTRACT_VERSION;
      return originalRun(context);
    };

    await runDeletion({ userId: USER_ID, stripeCustomerRef: null, store, steps });

    expect(tombstoneSeenFirst).toBe(true);
    expect(await isSubjectDenied(store, USER_ID, 'ai_processing')).toBe(true);
    expect(await isSubjectDenied(store, 'someone_else', 'ai_processing')).toBe(false);
  });

  it('is idempotent: a completed request is returned unchanged without running steps again', async () => {
    const store = new InMemoryDeletionStore();
    const first = buildSteps();
    const completed = await runDeletion({ userId: USER_ID, stripeCustomerRef: null, store, steps: first.steps });

    const second = buildSteps();
    const again = await runDeletion({ userId: USER_ID, stripeCustomerRef: null, store, steps: second.steps });

    expect(second.calls).toEqual([]);
    expect(again).toEqual(completed);
  });

  it.each([...DELETION_STEP_IDS])(
    'reports partial when %s throws, blocks its dependents and leaves no false completion',
    async (failingStep) => {
      const store = new InMemoryDeletionStore();
      const { steps } = buildSteps({ [failingStep]: 'throw' });

      const record = await runDeletion({ userId: USER_ID, stripeCustomerRef: null, store, steps });

      expect(record.status).toBe('partial');
      expect(record.completedAt).toBeNull();
      expect(record.steps[failingStep]).toMatchObject({ status: 'failed', reasonCode: 'step_error', attempts: 1 });
      const blocked = dependentsOf(failingStep);
      for (const id of DELETION_STEP_IDS) {
        if (id === failingStep) continue;
        const expected = blocked.includes(id) ? 'blocked' : 'done';
        expect(record.steps[id].status).toBe(expected);
      }
      // Safe codes only — raw error text never lands in the record.
      expect(JSON.stringify(record)).not.toContain('boom');
    },
  );

  it('resumes after a failure without re-running finished steps', async () => {
    const store = new InMemoryDeletionStore();
    const failing = buildSteps({ mentor_chats: 'fail' });
    const partial = await runDeletion({ userId: USER_ID, stripeCustomerRef: null, store, steps: failing.steps });
    expect(partial.status).toBe('partial');

    const retry = buildSteps();
    const record = await runDeletion({ userId: USER_ID, stripeCustomerRef: null, store, steps: retry.steps });

    expect(record.status).toBe('completed');
    expect(retry.calls).toEqual(['mentor_chats', 'profile', 'auth_account']);
    expect(record.steps.mentor_chats.attempts).toBe(2);
    expect(record.runCount).toBe(2);
    expect(record.tombstone).toEqual(partial.tombstone);
  });

  it('stays blocked on a manual step and completes only after the owner receipt', async () => {
    const store = new InMemoryDeletionStore();
    const { steps } = buildSteps({ stripe_customer: 'manual' });

    const record = await runDeletion({ userId: USER_ID, stripeCustomerRef: 'cus_123', store, steps, now: () => FIXED_NOW });

    expect(record.status).toBe('blocked');
    expect(record.steps.stripe_customer).toMatchObject({ status: 'manual_required', reasonCode: 'needs_owner' });
    expect(record.steps.auth_account.status).toBe('done');
    expect(record.stripeCustomerRef).toBe('cus_123');

    const rerun = await runDeletion({ userId: USER_ID, stripeCustomerRef: null, store, steps: buildSteps({ stripe_customer: 'manual' }).steps });
    expect(rerun.status).toBe('blocked');

    const closed = await recordManualStepCompletion({ store, subjectHash: record.subjectHash, stepId: 'stripe_customer' });
    expect(closed.status).toBe('completed');
    expect(closed.steps.stripe_customer).toMatchObject({ status: 'done', outcome: 'manual_completed', completedBy: 'owner' });
    expect(closed.stripeCustomerRef).toBeNull();
  });

  it('refuses a manual receipt for a step that is not awaiting one', async () => {
    const store = new InMemoryDeletionStore();
    const record = await runDeletion({ userId: USER_ID, stripeCustomerRef: null, store, steps: buildSteps().steps });

    await expect(
      recordManualStepCompletion({ store, subjectHash: record.subjectHash, stepId: 'profile' }),
    ).rejects.toThrow('not awaiting');
  });

  it('rejects a registry that omits a required subsystem or orders dependencies wrongly', async () => {
    const store = new InMemoryDeletionStore();
    const { steps } = buildSteps();

    await expect(
      runDeletion({ userId: USER_ID, stripeCustomerRef: null, store, steps: steps.filter((s) => s.id !== 'mentor_chats') }),
    ).rejects.toBeInstanceOf(DeletionRegistryError);
    await expect(
      runDeletion({ userId: USER_ID, stripeCustomerRef: null, store, steps: [...steps].reverse() }),
    ).rejects.toBeInstanceOf(DeletionRegistryError);
    expect(store.saveCount).toBe(0);
  });

  it('exposes a receipt with per-step state and retention exceptions', async () => {
    const store = new InMemoryDeletionStore();
    const record = await runDeletion({
      userId: USER_ID,
      stripeCustomerRef: null,
      store,
      steps: buildSteps({ gallery_submissions: 'fail' }).steps,
    });

    const receipt = toDeletionReceipt(record);
    expect(receipt.status).toBe('partial');
    expect(receipt.steps.map((step) => step.stepId)).toEqual([...DELETION_STEP_IDS]);
    expect(receipt.retentionExceptions.map((item) => item.dataClass)).toEqual(
      ['billing_records', 'backups', 'deletion_audit_record'],
    );
  });
});

describe('deriveRequestStatus', () => {
  it('prefers partial over blocked when a retryable failure exists', async () => {
    const store = new InMemoryDeletionStore();
    const record = await runDeletion({
      userId: USER_ID,
      stripeCustomerRef: 'cus_1',
      store,
      steps: buildSteps({ stripe_customer: 'manual', referral_promo: 'fail' }).steps,
    });
    expect(deriveRequestStatus(record.steps)).toBe('partial');
  });
});
