import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { randomBytes } from 'crypto';
import { TIER_DEFAULTS } from '@/lib/pricing';
import {
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_BILLING_EVENTS_ID,
    findProfileBySubscriptionId,
    getAdminTables,
    getOrCreateProfile,
    markStripeEventProcessed,
    updateProfileById,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';

function createRowId(): string {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return uuid;
    return randomBytes(16).toString('hex');
}

let _stripe: Stripe | null = null;
function getStripe() {
    if (!_stripe) {
        const raw = process.env.STRIPE_SECRET_KEY ?? '';
        const key = raw.replace(/[\r\n\s"']/g, '').trim();
        if (!key) {
            throw new Error('MISSING_STRIPE_SECRET_KEY');
        }
        _stripe = new Stripe(key, { apiVersion: '2026-02-25.clover' });
    }
    return _stripe;
}

function getWebhookSecret() {
    const raw = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    return raw.replace(/[\r\n\s"']/g, '').trim();
}

/**
 * Idempotency guard: returns true if this event has already been processed.
 * Uses a `stripe_events` table. If the table doesn't exist yet, silently skips
 * the guard (non-blocking) so deploys before the migration still work.
 */
async function isEventAlreadyProcessed(eventId: string): Promise<boolean> {
    try {
        return await markStripeEventProcessed(eventId);
    } catch {
        return false;
    }
}

export async function POST(request: NextRequest) {
    await ensureCoreAppwriteResources();

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
        return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
        event = getStripe().webhooks.constructEvent(body, signature, getWebhookSecret());
    } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        console.error(`Webhook signature verification failed: ${message}`);
        return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }

    // Idempotency: skip already-processed events
    if (await isEventAlreadyProcessed(event.id)) {
        return NextResponse.json({ received: true });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutComplete(session);
                break;
            }
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionUpdated(subscription);
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionCancelled(subscription);
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                await handlePaymentFailed(invoice);
                break;
            }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        console.error(`Webhook handler error: ${message}`);
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}

function toIsoFromUnix(value: number | null | undefined): string {
    if (!Number.isFinite(value) || !value) return '';
    return new Date(Number(value) * 1000).toISOString();
}

function sanitizeSubscriptionStatus(status: string | null | undefined): string {
    if (!status) return '';
    return status.substring(0, 32);
}

type SubscriptionSnapshot = {
    subscriptionStatus: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    interval: string;
};

function getSubscriptionSnapshot(subscription: Stripe.Subscription | null): SubscriptionSnapshot {
    if (!subscription) {
        return {
            subscriptionStatus: '',
            currentPeriodStart: '',
            currentPeriodEnd: '',
            cancelAtPeriodEnd: false,
            interval: '',
        };
    }

    const legacy = subscription as Stripe.Subscription & {
        current_period_start?: number;
        current_period_end?: number;
    };
    const firstItem = subscription.items?.data?.[0];

    return {
        subscriptionStatus: sanitizeSubscriptionStatus(subscription.status),
        currentPeriodStart: toIsoFromUnix(legacy.current_period_start ?? firstItem?.current_period_start),
        currentPeriodEnd: toIsoFromUnix(legacy.current_period_end ?? firstItem?.current_period_end),
        cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
        interval: firstItem?.price?.recurring?.interval || '',
    };
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.user_id;
    const checkoutMode = session.metadata?.checkout_mode;

    if (!userId || !checkoutMode) {
        console.error('Missing metadata in checkout session:', session.id);
        return;
    }

    if (checkoutMode === 'rapido_pack') {
        const quantity = parseInt(session.metadata?.rapido_quantity ?? '0', 10);
        if (quantity <= 0) return;

        const profile = await getOrCreateProfile({ id: userId, email: null, name: null });
        const nextRapidoBalance = profile.rapido_pens + quantity;
        await updateProfileById(userId, { rapido_pens: nextRapidoBalance });

        await recordBillingEvent({
            userId,
            eventType: checkoutMode,
            amountCents: typeof session.amount_total === 'number' ? session.amount_total : 0,
            currency: (session.currency || 'try').toLowerCase(),
            rapidoDelta: quantity,
            rapidoBalanceAfter: nextRapidoBalance,
            stripeSessionId: session.id,
            stripeCustomerId: (session.customer as string) ?? null,
            stripeSubscriptionId: (session.subscription as string) ?? null,
            metadata: {
                pricingTier: session.metadata?.pricing_tier ?? null,
                promoCode: session.metadata?.promo_code ?? null,
                promotionCodeId: session.metadata?.promotion_code_id ?? null,
            },
        });
    } else if (checkoutMode === 'premium_monthly' || checkoutMode === 'premium_yearly') {
        // Activate premium + grant premium rapido bonus
        const profile = await getOrCreateProfile({ id: userId, email: null, name: null });
        const currentRapido = profile.rapido_pens ?? 0;
        const nextRapidoBalance = Math.max(currentRapido, TIER_DEFAULTS.PREMIUM);
        const rapidoDelta = Math.max(0, nextRapidoBalance - currentRapido);
        const promoCode = (session.metadata?.promo_code || '').trim().substring(0, 64);

        let subscription: Stripe.Subscription | null = null;
        if (typeof session.subscription === 'string' && session.subscription) {
            try {
                subscription = await getStripe().subscriptions.retrieve(session.subscription);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'unknown error';
                console.warn('Could not retrieve Stripe subscription snapshot:', message);
            }
        }

        const snapshot = getSubscriptionSnapshot(subscription);

        await updateProfileById(userId, {
            is_premium: true,
            rapido_pens: nextRapidoBalance,
            stripe_customer_id: (session.customer as string) ?? '',
            stripe_subscription_id: (session.subscription as string) ?? '',
            subscription_status: snapshot.subscriptionStatus,
            subscription_current_period_start: snapshot.currentPeriodStart,
            subscription_current_period_end: snapshot.currentPeriodEnd,
            subscription_cancel_at_period_end: snapshot.cancelAtPeriodEnd,
            premium_started_at: new Date().toISOString(),
            premium_price_cents: typeof session.amount_total === 'number' ? Math.max(0, Math.floor(session.amount_total)) : 0,
            premium_currency: (session.currency || 'try').toLowerCase(),
            premium_interval: snapshot.interval || (checkoutMode === 'premium_yearly' ? 'year' : 'month'),
            premium_promo_code: promoCode,
        });

        await recordBillingEvent({
            userId,
            eventType: checkoutMode,
            amountCents: typeof session.amount_total === 'number' ? session.amount_total : 0,
            currency: (session.currency || 'try').toLowerCase(),
            rapidoDelta,
            rapidoBalanceAfter: nextRapidoBalance,
            stripeSessionId: session.id,
            stripeCustomerId: (session.customer as string) ?? null,
            stripeSubscriptionId: (session.subscription as string) ?? null,
            metadata: {
                pricingTier: session.metadata?.pricing_tier ?? null,
                promoCode: session.metadata?.promo_code ?? null,
                promotionCodeId: session.metadata?.promotion_code_id ?? null,
            },
        });

        // Fire conversion_to_paid analytics event
        const conversionMetadata: Record<string, unknown> = {
            userId,
            checkoutMode,
            stripeSessionId: session.id,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
        };
        // Include UTM metadata from session if present
        if (session.metadata?.utm_source) conversionMetadata.utm_source = session.metadata.utm_source;
        if (session.metadata?.utm_medium) conversionMetadata.utm_medium = session.metadata.utm_medium;
        if (session.metadata?.utm_campaign) conversionMetadata.utm_campaign = session.metadata.utm_campaign;
        if (session.metadata?.utm_term) conversionMetadata.utm_term = session.metadata.utm_term;
        if (session.metadata?.utm_content) conversionMetadata.utm_content = session.metadata.utm_content;
        if (session.metadata?.landing_path) conversionMetadata.landing_path = session.metadata.landing_path;

        console.info(
            '[growth-conversion][DrawOrDie]',
            JSON.stringify({
                eventName: 'conversion_to_paid',
                metadata: conversionMetadata,
                utm: {},
                page: '/api/webhook/stripe',
                referrer: null,
                occurredAt: new Date().toISOString(),
                ip: 'server',
            }),
        );
    }
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
    const profile = await findProfileBySubscriptionId(subscription.id);

    if (profile) {
        const snapshot = getSubscriptionSnapshot(subscription);
        await updateProfileById(profile.id, {
            is_premium: false,
            subscription_status: snapshot.subscriptionStatus || 'canceled',
            subscription_current_period_start: snapshot.currentPeriodStart,
            subscription_current_period_end: snapshot.currentPeriodEnd,
            subscription_cancel_at_period_end: snapshot.cancelAtPeriodEnd,
        });
    }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const profile = await findProfileBySubscriptionId(subscription.id);
    if (!profile) return;

    const snapshot = getSubscriptionSnapshot(subscription);
    const isPremium = subscription.status === 'active' || subscription.status === 'trialing';

    await updateProfileById(profile.id, {
        is_premium: isPremium,
        subscription_status: snapshot.subscriptionStatus,
        subscription_current_period_start: snapshot.currentPeriodStart,
        subscription_current_period_end: snapshot.currentPeriodEnd,
        subscription_cancel_at_period_end: snapshot.cancelAtPeriodEnd,
        premium_interval: snapshot.interval || profile.premium_interval || '',
    });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const invoiceWithSubscription = invoice as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
    };
    const subscriptionId =
        typeof invoiceWithSubscription.subscription === 'string'
            ? invoiceWithSubscription.subscription
            : invoiceWithSubscription.subscription &&
                typeof invoiceWithSubscription.subscription === 'object' &&
                'id' in invoiceWithSubscription.subscription
                ? String(invoiceWithSubscription.subscription.id)
                : '';
    if (!subscriptionId) return;

    const profile = await findProfileBySubscriptionId(subscriptionId);

    if (profile) {
        await updateProfileById(profile.id, {
            subscription_status: 'past_due',
        });
        console.warn(`Payment failed for user ${profile.id}, subscription ${subscriptionId}`);
    }
}

type RecordBillingEventInput = {
    userId: string;
    eventType: string;
    amountCents: number;
    currency: string;
    rapidoDelta: number;
    rapidoBalanceAfter: number;
    stripeSessionId: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    metadata?: Record<string, unknown>;
};

async function recordBillingEvent(input: RecordBillingEventInput): Promise<void> {
    const tables = getAdminTables();
    await tables.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_BILLING_EVENTS_ID,
        rowId: createRowId(),
        data: {
            user_id: input.userId,
            event_type: input.eventType,
            amount_cents: Math.max(0, Math.floor(input.amountCents || 0)),
            currency: (input.currency || 'try').toLowerCase(),
            rapido_delta: Math.floor(input.rapidoDelta || 0),
            rapido_balance_after: Math.max(0, Math.floor(input.rapidoBalanceAfter || 0)),
            stripe_session_id: input.stripeSessionId || '',
            stripe_customer_id: input.stripeCustomerId || '',
            stripe_subscription_id: input.stripeSubscriptionId || '',
            metadata_json: JSON.stringify(input.metadata ?? {}),
        },
    });
}
