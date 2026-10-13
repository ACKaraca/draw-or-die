import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';

import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { logServerError } from '@/lib/logger';
import { getStripeServerClient, getStripeWebhookSecret, isStripeWebhookPaused } from '@/lib/stripe-server';
import { handleStripeEvent } from '@/lib/stripe-webhook-processor';

/**
 * Stripe webhook entry point: verifies the signature, then hands the event to the
 * exactly-once processor. Response codes drive Stripe's retry behaviour:
 * 2xx = done (processed, duplicate, ignored or rejected-and-recorded),
 * 409 = another worker holds the lease, 500 = handler failed (event kept as `failed`),
 * 503 = processing paused or the event ledger is unavailable (fail closed).
 */
export async function POST(request: NextRequest) {
    if (isStripeWebhookPaused()) {
        return NextResponse.json({ error: 'Webhook processing paused' }, { status: 503 });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
        return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let stripe: Stripe;
    let event: Stripe.Event;
    try {
        stripe = getStripeServerClient();
        event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());
    } catch (error) {
        logServerError('webhook.stripe.signature', error);
        return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }

    try {
        await ensureCoreAppwriteResources();
    } catch (error) {
        logServerError('webhook.stripe.bootstrap', error, { eventId: event.id });
        return NextResponse.json({ error: 'Event store unavailable' }, { status: 503 });
    }

    let result: Awaited<ReturnType<typeof handleStripeEvent>>;
    try {
        result = await handleStripeEvent(event, stripe);
    } catch (error) {
        logServerError('webhook.stripe.ledger', error, { eventId: event.id, eventType: event.type });
        return NextResponse.json({ error: 'Event store unavailable' }, { status: 503 });
    }

    switch (result.kind) {
        case 'duplicate':
            return NextResponse.json({ received: true, duplicate: true });
        case 'busy':
            return NextResponse.json({ error: 'Event is being processed' }, { status: 409 });
        case 'processed':
            return NextResponse.json({ received: true, status: result.status });
        case 'failed':
            return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
        default: {
            const _exhaustive: never = result;
            throw new Error(`Unhandled webhook result: ${JSON.stringify(_exhaustive)}`);
        }
    }
}
