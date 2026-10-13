import { NextResponse, type NextRequest } from 'next/server';

import { getAuthenticatedUserFromRequest, isVerifiedAdmin } from '@/lib/appwrite/server';
import { logServerError, logServerInfo } from '@/lib/logger';
import { computeSubjectHash, recordManualStepCompletion, toDeletionReceipt } from '@/lib/privacy/deletion';
import { createAppwriteDeletionStore, ensureDeletionRequestsTable } from '@/lib/privacy/deletion-store';
import { PrivacyApiMessages } from '@/lib/privacy/messages';
import { getRequestLanguage } from '@/lib/server-i18n';

export const dynamic = 'force-dynamic';

// Only the Stripe customer redaction is a manual owner step today; widen deliberately, not by input.
const MANUAL_STEPS = ['stripe_customer'] as const;
const SUBJECT_HASH_PATTERN = /^[a-f0-9]{64}$/;
const USER_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const NOTE_MAX = 500;

const NO_STORE = { 'Cache-Control': 'no-store, private' };

type ParsedBody = { subjectHash: string; step: (typeof MANUAL_STEPS)[number]; note: string };

function parseBody(body: unknown): ParsedBody | null {
  if (!body || typeof body !== 'object') return null;
  const { subjectUserId, requestId, step, note } = body as Record<string, unknown>;
  if (!MANUAL_STEPS.includes(step as ParsedBody['step'])) return null;
  if (typeof note !== 'string' || !note.trim() || note.length > NOTE_MAX) return null;

  // requestId is the subject hash shown in deletion logs; exactly one identifier is accepted.
  if (typeof requestId === 'string' && subjectUserId === undefined && SUBJECT_HASH_PATTERN.test(requestId)) {
    return { subjectHash: requestId, step: step as ParsedBody['step'], note: note.trim() };
  }
  if (typeof subjectUserId === 'string' && requestId === undefined && USER_ID_PATTERN.test(subjectUserId)) {
    return { subjectHash: computeSubjectHash(subjectUserId), step: step as ParsedBody['step'], note: note.trim() };
  }
  return null;
}

/** Admin-only receipt for a deletion step that was completed by hand (contract in docs/API.md). Idempotent. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const lang = getRequestLanguage(request);
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user || !isVerifiedAdmin(user)) {
    return NextResponse.json({ error: PrivacyApiMessages.forbidden(lang) }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: PrivacyApiMessages.invalidBody(lang) }, { status: 400 });
  }
  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json({ error: PrivacyApiMessages.invalidBody(lang) }, { status: 400 });
  }
  const { subjectHash, step, note } = parsed;

  try {
    await ensureDeletionRequestsTable();
    const store = createAppwriteDeletionStore();
    const record = await store.get(subjectHash);
    if (!record) {
      return NextResponse.json({ error: PrivacyApiMessages.deletionRequestNotFound(lang) }, { status: 404 });
    }

    const receipt = record.steps[step];
    if (receipt?.status === 'done') {
      return NextResponse.json({ request: toDeletionReceipt(record), alreadyRecorded: true }, { headers: NO_STORE });
    }
    if (receipt?.status !== 'manual_required') {
      return NextResponse.json(
        { error: PrivacyApiMessages.manualStepNotPending(lang), code: 'STEP_NOT_AWAITING_MANUAL_RECEIPT' },
        { status: 409 },
      );
    }

    const updated = await recordManualStepCompletion({ store, subjectHash, stepId: step });
    logServerInfo('privacy.deletion.manual_receipt.admin', { subjectHash, stepId: step, operator: user.id, note });
    return NextResponse.json({ request: toDeletionReceipt(updated), alreadyRecorded: false }, { headers: NO_STORE });
  } catch (error) {
    logServerError('privacy.deletion.manual_receipt_failed', error, { subjectHash, stepId: step, operator: user.id });
    return NextResponse.json({ error: PrivacyApiMessages.deletionUnavailable(lang) }, { status: 503 });
  }
}
