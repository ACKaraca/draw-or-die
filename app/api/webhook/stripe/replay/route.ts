import { NextResponse, type NextRequest } from 'next/server';

import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { getAuthenticatedUserFromRequest, isVerifiedAdmin, type StripeEventRow } from '@/lib/appwrite/server';
import { logServerError, logServerInfo } from '@/lib/logger';
import { findStripeEventRow, listStripeEventsByStatus } from '@/lib/stripe-event-ledger';
import { getStripeServerClient } from '@/lib/stripe-server';
import { handleStripeEvent } from '@/lib/stripe-webhook-processor';

const MAX_EVENTS_PER_CALL = 25;
const EVENT_ID_PATTERN = /^evt_[A-Za-z0-9]{6,120}$/;

type ReplayBody = {
  eventIds?: unknown;
  dryRun?: unknown;
  includeRejected?: unknown;
};

function summarizeRow(row: StripeEventRow | null) {
  if (!row) return null;
  return {
    status: row.status || 'legacy',
    eventType: row.event_type ?? null,
    attempts: row.attempts ?? null,
    outcome: row.outcome ?? null,
    lastError: row.last_error ?? null,
    updatedAt: row.updated_at ?? row.processed_at ?? null,
  };
}

/**
 * Admin-only replay of failed Stripe events (see the branch-16 replay runbook).
 * Dry-run by default: lists the stored state and the Stripe event without changing anything.
 * Execution requires explicit event ids; the event is re-fetched from Stripe (authentic by
 * construction) and goes through the same idempotent processor as live deliveries.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user || !isVerifiedAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: ReplayBody;
  try {
    body = (await request.json()) as ReplayBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const isDryRun = body.dryRun !== false;
  const includeRejected = body.includeRejected === true;
  const rawIds = Array.isArray(body.eventIds) ? body.eventIds : [];
  const eventIds = rawIds.filter((id): id is string => typeof id === 'string' && EVENT_ID_PATTERN.test(id));
  if (eventIds.length !== rawIds.length || eventIds.length > MAX_EVENTS_PER_CALL) {
    return NextResponse.json({ error: `eventIds must be up to ${MAX_EVENTS_PER_CALL} evt_ ids` }, { status: 400 });
  }
  if (!isDryRun && eventIds.length === 0) {
    return NextResponse.json({ error: 'Execution requires explicit eventIds' }, { status: 400 });
  }

  try {
    await ensureCoreAppwriteResources();
    const stripe = getStripeServerClient();

    if (eventIds.length === 0) {
      const failed = await listStripeEventsByStatus('failed', MAX_EVENTS_PER_CALL);
      return NextResponse.json({
        dryRun: true,
        events: failed.map((row) => ({ eventId: row.event_id, stored: summarizeRow(row) })),
      });
    }

    const results = [];
    for (const eventId of eventIds) {
      const stored = await findStripeEventRow(eventId);
      const event = await stripe.events.retrieve(eventId);
      if (isDryRun) {
        results.push({ eventId, stored: summarizeRow(stored), stripe: { type: event.type, livemode: event.livemode } });
        continue;
      }

      const result = await handleStripeEvent(event, stripe, { allowRejected: includeRejected });
      logServerInfo('webhook.stripe.replay', { eventId, operator: user.id, result: result.kind });
      results.push({ eventId, before: summarizeRow(stored), result });
    }

    return NextResponse.json({ dryRun: isDryRun, events: results });
  } catch (error) {
    logServerError('webhook.stripe.replay', error, { eventIds });
    return NextResponse.json({ error: 'Replay failed' }, { status: 500 });
  }
}
