import { NextResponse, type NextRequest } from 'next/server';

import { getAuthenticatedUserFromRequest, getProfileRowForUser } from '@/lib/appwrite/server';
import { logServerError, logServerInfo } from '@/lib/logger';
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/privacy/constants';
import { createAppwritePrivacyPort } from '@/lib/privacy/data-port';
import { computeSubjectHash, runDeletion, toDeletionReceipt } from '@/lib/privacy/deletion';
import { createDefaultDeletionSteps } from '@/lib/privacy/deletion-steps';
import { createAppwriteDeletionStore, ensureDeletionRequestsTable } from '@/lib/privacy/deletion-store';
import { PrivacyApiMessages } from '@/lib/privacy/messages';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRequestLanguage } from '@/lib/server-i18n';

export const dynamic = 'force-dynamic';

const DELETE_RATE_LIMIT = { maxRequests: 5, windowMs: 60 * 60 * 1000 };

const NO_STORE = { 'Cache-Control': 'no-store, private' };

export async function GET(request: NextRequest): Promise<NextResponse> {
  const lang = getRequestLanguage(request);
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: PrivacyApiMessages.signInRequired(lang) }, { status: 401 });
  }

  try {
    await ensureDeletionRequestsTable();
    const record = await createAppwriteDeletionStore().get(computeSubjectHash(user.id));
    return NextResponse.json({ request: record ? toDeletionReceipt(record) : null }, { headers: NO_STORE });
  } catch (error) {
    logServerError('privacy.deletion.status_failed', error, { userId: user.id });
    return NextResponse.json({ error: PrivacyApiMessages.deletionUnavailable(lang) }, { status: 503 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const lang = getRequestLanguage(request);
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: PrivacyApiMessages.signInRequired(lang) }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`account-delete:${user.id}`, DELETE_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: PrivacyApiMessages.rateLimited(lang) }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: PrivacyApiMessages.invalidBody(lang) }, { status: 400 });
  }
  const confirmation = body && typeof body === 'object' ? (body as Record<string, unknown>).confirmation : undefined;
  if (confirmation !== ACCOUNT_DELETION_CONFIRMATION) {
    return NextResponse.json({ error: PrivacyApiMessages.confirmationRequired(lang) }, { status: 400 });
  }

  try {
    await ensureDeletionRequestsTable();
    const profileRow = await getProfileRowForUser(user.id);
    const rawCustomerId = profileRow?.stripe_customer_id;
    const stripeCustomerRef = typeof rawCustomerId === 'string' && rawCustomerId.trim() ? rawCustomerId.trim() : null;

    logServerInfo('privacy.deletion.confirmed', { userId: user.id });
    const record = await runDeletion({
      userId: user.id,
      stripeCustomerRef,
      store: createAppwriteDeletionStore(),
      steps: createDefaultDeletionSteps(createAppwritePrivacyPort()),
    });

    return NextResponse.json(
      { request: toDeletionReceipt(record) },
      { status: record.status === 'completed' ? 200 : 202, headers: NO_STORE },
    );
  } catch (error) {
    logServerError('privacy.deletion.failed', error, { userId: user.id });
    return NextResponse.json({ error: PrivacyApiMessages.deletionUnavailable(lang) }, { status: 503 });
  }
}
