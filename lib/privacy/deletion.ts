import { createHash } from 'crypto';

import { logServerError, logServerInfo } from '@/lib/logger';
import { BACKUP_RETENTION_DAYS, BILLING_RECORD_RETENTION_YEARS } from '@/lib/privacy/retention';

/**
 * Versioned downstream-deny / tombstone contract. Bump the version whenever deny scopes,
 * retention exceptions or the required step set change; existing requests keep the version
 * (and tombstone) they were created with so a deny contract is never silently rewritten.
 */
export const DELETION_CONTRACT_VERSION = 'dod-deletion/2026-10-13.v1';

export const DELETION_STEP_IDS = [
  'storage_files',
  'analysis_history',
  'gallery_submissions',
  'mentor_chats',
  'community_content',
  'referral_promo',
  'billing_records',
  'stripe_customer',
  'profile',
  'auth_account',
] as const;

export type DeletionStepId = (typeof DELETION_STEP_IDS)[number];

/** What downstream systems must refuse for a tombstoned subject, effective from request time. */
export const DELETION_DENY_SCOPES = [
  'ai_processing',
  'memory_retrieval',
  'new_uploads',
  'public_delivery',
  'analytics_linkage',
] as const;

export type DeletionDenyScope = (typeof DELETION_DENY_SCOPES)[number];


export type RetentionException = {
  dataClass: 'billing_records' | 'backups' | 'deletion_audit_record';
  basis: 'legal_obligation' | 'backup_rotation' | 'accountability';
  retainUntil: string;
};

export type DeletionTombstone = {
  contractVersion: string;
  subjectHash: string;
  requestedAt: string;
  denyScopes: DeletionDenyScope[];
  retentionExceptions: RetentionException[];
};

export type DeletionStepStatus = 'pending' | 'done' | 'failed' | 'blocked' | 'manual_required';

export type DeletionStepOutcome = 'deleted' | 'not_applicable' | 'retained_legal_hold' | 'manual_completed';

export type DeletionStepReceipt = {
  stepId: DeletionStepId;
  status: DeletionStepStatus;
  outcome?: DeletionStepOutcome;
  affectedCount?: number;
  retainedUntil?: string;
  /** Safe, non-sensitive code; never a raw error message. */
  reasonCode?: string;
  attempts: number;
  updatedAt: string;
  completedAt?: string;
  completedBy?: 'system' | 'owner';
};

export type DeletionRequestStatus = 'requested' | 'in_progress' | 'partial' | 'blocked' | 'completed';

export type DeletionRequestRecord = {
  subjectHash: string;
  status: DeletionRequestStatus;
  contractVersion: string;
  tombstone: DeletionTombstone;
  steps: Record<DeletionStepId, DeletionStepReceipt>;
  /** Billing reference kept only until the Stripe step is resolved, then cleared. */
  stripeCustomerRef: string | null;
  requestedAt: string;
  updatedAt: string;
  completedAt: string | null;
  runCount: number;
};

export type DeletionStepContext = {
  userId: string;
  stripeCustomerRef: string | null;
  now: Date;
};

export type DeletionStepResult =
  | { status: 'done'; outcome: Exclude<DeletionStepOutcome, 'manual_completed'>; affectedCount?: number; retainedUntil?: string }
  | { status: 'manual_required'; reasonCode: string }
  | { status: 'failed'; reasonCode: string };

export type DeletionStepDefinition = {
  id: DeletionStepId;
  /** Steps that must be `done` first (e.g. files are collected from rows before the rows go). */
  dependsOn: readonly DeletionStepId[];
  run(context: DeletionStepContext): Promise<DeletionStepResult>;
};

export type DeletionRequestStore = {
  get(subjectHash: string): Promise<DeletionRequestRecord | null>;
  save(record: DeletionRequestRecord): Promise<void>;
};

export type RunDeletionInput = {
  userId: string;
  stripeCustomerRef: string | null;
  store: DeletionRequestStore;
  steps: readonly DeletionStepDefinition[];
  now?: () => Date;
};

export class DeletionRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeletionRegistryError';
  }
}

export function computeSubjectHash(userId: string): string {
  return createHash('sha256').update(`dod:deletion-subject:v1:${userId}`).digest('hex');
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function billingRetentionUntil(now: Date): string {
  return addYears(now, BILLING_RECORD_RETENTION_YEARS).toISOString();
}

export function buildTombstone(subjectHash: string, now: Date): DeletionTombstone {
  return {
    contractVersion: DELETION_CONTRACT_VERSION,
    subjectHash,
    requestedAt: now.toISOString(),
    denyScopes: [...DELETION_DENY_SCOPES],
    retentionExceptions: [
      { dataClass: 'billing_records', basis: 'legal_obligation', retainUntil: billingRetentionUntil(now) },
      { dataClass: 'backups', basis: 'backup_rotation', retainUntil: addDays(now, BACKUP_RETENTION_DAYS).toISOString() },
      { dataClass: 'deletion_audit_record', basis: 'accountability', retainUntil: billingRetentionUntil(now) },
    ],
  };
}

/** Every required subsystem must be registered exactly once, with dependencies that exist and come earlier. */
export function validateStepRegistry(steps: readonly DeletionStepDefinition[]): void {
  const seen = new Set<DeletionStepId>();
  for (const step of steps) {
    if (seen.has(step.id)) throw new DeletionRegistryError(`Duplicate deletion step: ${step.id}`);
    for (const dependency of step.dependsOn) {
      if (!seen.has(dependency)) {
        throw new DeletionRegistryError(`Step ${step.id} depends on ${dependency}, which is not registered before it`);
      }
    }
    seen.add(step.id);
  }
  const missing = DELETION_STEP_IDS.filter((id) => !seen.has(id));
  if (missing.length > 0) throw new DeletionRegistryError(`Missing required deletion steps: ${missing.join(', ')}`);
}

function createPendingReceipts(nowIso: string): Record<DeletionStepId, DeletionStepReceipt> {
  const receipts = {} as Record<DeletionStepId, DeletionStepReceipt>;
  for (const stepId of DELETION_STEP_IDS) {
    receipts[stepId] = { stepId, status: 'pending', attempts: 0, updatedAt: nowIso };
  }
  return receipts;
}

export function createDeletionRequest(
  userId: string,
  stripeCustomerRef: string | null,
  now: Date,
): DeletionRequestRecord {
  const subjectHash = computeSubjectHash(userId);
  const nowIso = now.toISOString();
  return {
    subjectHash,
    status: 'requested',
    contractVersion: DELETION_CONTRACT_VERSION,
    tombstone: buildTombstone(subjectHash, now),
    steps: createPendingReceipts(nowIso),
    stripeCustomerRef,
    requestedAt: nowIso,
    updatedAt: nowIso,
    completedAt: null,
    runCount: 0,
  };
}

/** completed only when every required step is done; failures are retryable (partial), the rest wait on someone (blocked). */
export function deriveRequestStatus(steps: Record<DeletionStepId, DeletionStepReceipt>): DeletionRequestStatus {
  const receipts = DELETION_STEP_IDS.map((id) => steps[id]);
  if (receipts.every((receipt) => receipt?.status === 'done')) return 'completed';
  if (receipts.some((receipt) => receipt?.status === 'failed')) return 'partial';
  if (receipts.some((receipt) => receipt?.status === 'blocked' || receipt?.status === 'manual_required')) {
    return 'blocked';
  }
  return 'in_progress';
}

function finalizeStatus(record: DeletionRequestRecord, nowIso: string): void {
  record.status = deriveRequestStatus(record.steps);
  record.updatedAt = nowIso;
  if (record.status === 'completed') {
    record.completedAt = record.completedAt ?? nowIso;
    record.stripeCustomerRef = null;
  }
}

function mergeMissingReceipts(record: DeletionRequestRecord, nowIso: string): void {
  for (const stepId of DELETION_STEP_IDS) {
    if (!record.steps[stepId]) record.steps[stepId] = { stepId, status: 'pending', attempts: 0, updatedAt: nowIso };
  }
}

/**
 * Runs (or resumes) the deletion request for `userId`. The tombstone is persisted before any
 * destructive step, every step result is persisted as it lands, finished steps are never re-run,
 * and a completed request is returned unchanged — so calling this repeatedly is safe.
 */
export async function runDeletion(input: RunDeletionInput): Promise<DeletionRequestRecord> {
  validateStepRegistry(input.steps);
  const now = input.now ?? (() => new Date());
  const subjectHash = computeSubjectHash(input.userId);

  let record = await input.store.get(subjectHash);
  if (record?.status === 'completed') return record;

  if (!record) {
    record = createDeletionRequest(input.userId, input.stripeCustomerRef, now());
    await input.store.save(record);
    logServerInfo('privacy.deletion.requested', { subjectHash, contractVersion: record.contractVersion });
  }

  mergeMissingReceipts(record, now().toISOString());
  if (!record.stripeCustomerRef && input.stripeCustomerRef && record.steps.stripe_customer.status !== 'done') {
    record.stripeCustomerRef = input.stripeCustomerRef;
  }
  record.status = 'in_progress';
  record.runCount += 1;
  record.updatedAt = now().toISOString();
  await input.store.save(record);

  for (const step of input.steps) {
    const receipt = record.steps[step.id];
    if (receipt.status === 'done') continue;

    const stepNow = now();
    const stepNowIso = stepNow.toISOString();
    const unmet = step.dependsOn.filter((dependency) => record.steps[dependency].status !== 'done');
    if (unmet.length > 0) {
      record.steps[step.id] = {
        ...receipt,
        status: 'blocked',
        reasonCode: `dependency_incomplete:${unmet.join(',')}`,
        updatedAt: stepNowIso,
      };
      continue;
    }

    let result: DeletionStepResult;
    try {
      result = await step.run({ userId: input.userId, stripeCustomerRef: record.stripeCustomerRef, now: stepNow });
    } catch (error) {
      logServerError('privacy.deletion.step', error, { subjectHash, stepId: step.id });
      result = { status: 'failed', reasonCode: 'step_error' };
    }

    const attempts = receipt.attempts + 1;
    switch (result.status) {
      case 'done':
        record.steps[step.id] = {
          stepId: step.id,
          status: 'done',
          outcome: result.outcome,
          affectedCount: result.affectedCount,
          retainedUntil: result.retainedUntil,
          attempts,
          updatedAt: stepNowIso,
          completedAt: stepNowIso,
          completedBy: 'system',
        };
        break;
      case 'manual_required':
        logServerInfo('privacy.deletion.manual_action_required', {
          subjectHash,
          stepId: step.id,
          reasonCode: result.reasonCode,
        });
        record.steps[step.id] = {
          stepId: step.id,
          status: result.status,
          reasonCode: result.reasonCode,
          attempts,
          updatedAt: stepNowIso,
        };
        break;
      case 'failed':
        record.steps[step.id] = {
          stepId: step.id,
          status: result.status,
          reasonCode: result.reasonCode,
          attempts,
          updatedAt: stepNowIso,
        };
        break;
      default: {
        const _exhaustive: never = result;
        throw new Error(`Unhandled deletion step result: ${JSON.stringify(_exhaustive)}`);
      }
    }
    await input.store.save(record);
  }

  finalizeStatus(record, now().toISOString());
  await input.store.save(record);
  logServerInfo('privacy.deletion.run', {
    subjectHash,
    status: record.status,
    runCount: record.runCount,
    steps: DELETION_STEP_IDS.map((id) => `${id}:${record.steps[id].status}`).join(' '),
  });
  return record;
}

/**
 * Owner-side receipt for a step that cannot be automated safely (e.g. Stripe customer redaction).
 * Only `manual_required` steps can be closed this way.
 */
export async function recordManualStepCompletion(input: {
  store: DeletionRequestStore;
  subjectHash: string;
  stepId: DeletionStepId;
  now?: Date;
}): Promise<DeletionRequestRecord> {
  const record = await input.store.get(input.subjectHash);
  if (!record) throw new Error('Deletion request not found');
  const receipt = record.steps[input.stepId];
  if (receipt?.status !== 'manual_required') {
    throw new Error(`Step ${input.stepId} is not awaiting a manual receipt`);
  }

  const nowIso = (input.now ?? new Date()).toISOString();
  record.steps[input.stepId] = {
    ...receipt,
    status: 'done',
    outcome: 'manual_completed',
    reasonCode: undefined,
    updatedAt: nowIso,
    completedAt: nowIso,
    completedBy: 'owner',
  };
  if (input.stepId === 'stripe_customer') record.stripeCustomerRef = null;
  finalizeStatus(record, nowIso);
  await input.store.save(record);
  logServerInfo('privacy.deletion.manual_receipt', { subjectHash: input.subjectHash, stepId: input.stepId });
  return record;
}

/** Downstream deny check: true from the moment a deletion request exists for this user. */
export async function isSubjectDenied(
  store: DeletionRequestStore,
  userId: string,
  scope: DeletionDenyScope,
): Promise<boolean> {
  const record = await store.get(computeSubjectHash(userId));
  return Boolean(record?.tombstone.denyScopes.includes(scope));
}

/** User-facing receipt: per-step state without internal reason details beyond safe codes. */
export type DeletionReceipt = {
  status: DeletionRequestStatus;
  contractVersion: string;
  requestedAt: string;
  completedAt: string | null;
  steps: Array<Pick<DeletionStepReceipt, 'stepId' | 'status' | 'outcome' | 'retainedUntil' | 'reasonCode'>>;
  retentionExceptions: RetentionException[];
};

export function toDeletionReceipt(record: DeletionRequestRecord): DeletionReceipt {
  return {
    status: record.status,
    contractVersion: record.contractVersion,
    requestedAt: record.requestedAt,
    completedAt: record.completedAt,
    steps: DELETION_STEP_IDS.map((id) => {
      const { stepId, status, outcome, retainedUntil, reasonCode } = record.steps[id];
      return { stepId, status, outcome, retainedUntil, reasonCode };
    }),
    retentionExceptions: record.tombstone.retentionExceptions,
  };
}
