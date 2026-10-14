import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { TIER_DEFAULTS } from '@/lib/pricing';
import {
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_PROFILES_ID,
    findProfileBySubscriptionId,
    getAdminTables,
    getOrCreateProfile,
    markStripeEventProcessed,
    recordBillingEvent,
    updateProfileById,
    type NormalizedUserProfile,
    type UserProfileRow,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { logServerError, logServerInfo } from '@/lib/logger';
import { isHoldActive } from '@/lib/p0-holds';
import { releaseStripeEvent } from '@/lib/stripe-event-ledger';

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

type EventLedgerState = 'recorded' | 'duplicate' | 'unavailable';

/**
 * Idempotency guard backed by the `stripe_events` table. If the table doesn't exist
 * yet, the guard is skipped (non-blocking) so deploys before the migration still work.
 */
async function recordEventInLedger(eventId: string): Promise<EventLedgerState> {
    try {
        return (await markStripeEventProcessed(eventId)) ? 'duplicate' : 'recorded';
    } catch (error) {
        logServerError('webhook.stripe.ledger', error, { eventId });
        return 'unavailable';
    }
}

type BillingEventInput = Parameters<typeof recordBillingEvent>[0];

/**
 * The credit has already been applied when this runs; a ledger failure must not fail the
 * webhook, otherwise Stripe's retry would grant the purchase a second time.
 */
async function recordBillingEventSafely(event: BillingEventInput): Promise<void> {
    try {
        await recordBillingEvent(event);
    } catch (error) {
        logServerError('webhook.stripe.billing-event', error, {
            userId: event.userId,
            eventType: event.eventType,
            stripeSessionId: event.stripeSessionId ?? null,
        });
    }
}

/** Atomically adds Rapido to the profile when its row id is known; returns the new balance. */
async function creditRapidoPens(userId: string, profile: NormalizedUserProfile, amount: number): Promise<number> {
    if (profile.row_id) {
        const updated = await getAdminTables().incrementRowColumn<UserProfileRow>({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: APPWRITE_TABLE_PROFILES_ID,
            rowId: profile.row_id,
            column: 'rapido_pens',
            value: amount,
        });
        return Number.isFinite(updated.rapido_pens) ? Number(updated.rapido_pens) : profile.rapido_pens + amount;
    }

    const nextRapidoBalance = profile.rapido_pens + amount;
    await updateProfileById(userId, { rapido_pens: nextRapidoBalance });
    return nextRapidoBalance;
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

    // P0 hold: the signed event is verified but no side effect runs and it is NOT recorded as
    // processed. A non-2xx makes Stripe retry it (and it stays replayable from the Stripe
    // dashboard), so nothing is lost while effects are paused.
    if (await isHoldActive('stripe_effects')) {
        logServerInfo('webhook.stripe.held', { eventId: event.id, eventType: event.type });
        return NextResponse.json(
            { error: 'Stripe event processing is paused', code: 'CAPABILITY_ON_HOLD' },
            { status: 503, headers: { 'Retry-After': '300' } },
        );
    }

    // Idempotency: skip already-processed events
    const ledgerState = await recordEventInLedger(event.id);
    if (ledgerState === 'duplicate') {
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
            case 'invoice.paid': {
                const invoice = event.data.object as Stripe.Invoice;
                await handleInvoicePaid(invoice);
                break;
            }
        }
    } catch (error) {
        logServerError('webhook.stripe.handler', error, { eventId: event.id, eventType: event.type });
        // Un-mark the event so Stripe's retry is processed instead of hitting the duplicate path.
        if (ledgerState === 'recorded') {
            await releaseStripeEvent(event.id);
        }
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
        const nextRapidoBalance = await creditRapidoPens(userId, profile, quantity);

        await recordBillingEventSafely({
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

        await recordBillingEventSafely({
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

/** Stripe moved the subscription reference to `parent.subscription_details` in newer API versions. */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string {
    const legacy = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
    const fromParent = invoice.parent?.subscription_details?.subscription;
    const candidate = fromParent ?? legacy;
    if (typeof candidate === 'string') return candidate;
    if (candidate && typeof candidate === 'object' && 'id' in candidate) return String(candidate.id);
    return '';
}

/**
 * Renewal invoices refill the monthly Premium allowance (same "top up to at least
 * TIER_DEFAULTS.PREMIUM" rule as the first purchase). The first invoice is skipped because
 * checkout.session.completed already granted it.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
    if (invoice.billing_reason !== 'subscription_cycle') return;

    const subscriptionId = getInvoiceSubscriptionId(invoice);
    if (!subscriptionId) return;

    const profile = await findProfileBySubscriptionId(subscriptionId);
    if (!profile) return;

    const currentRapido = Number.isFinite(profile.rapido_pens) ? profile.rapido_pens : 0;
    const rapidoDelta = Math.max(0, TIER_DEFAULTS.PREMIUM - currentRapido);
    const nextRapidoBalance = rapidoDelta > 0
        ? await creditRapidoPens(profile.id, profile, rapidoDelta)
        : currentRapido;

    await updateProfileById(profile.id, {
        is_premium: true,
        subscription_status: 'active',
    });

    await recordBillingEventSafely({
        userId: profile.id,
        eventType: 'premium_renewal',
        amountCents: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : 0,
        currency: (invoice.currency || 'try').toLowerCase(),
        rapidoDelta,
        rapidoBalanceAfter: nextRapidoBalance,
        stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : null,
        stripeSubscriptionId: subscriptionId,
        metadata: { invoiceId: invoice.id ?? null },
    });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionId = getInvoiceSubscriptionId(invoice);
    if (!subscriptionId) return;

    const profile = await findProfileBySubscriptionId(subscriptionId);

    if (profile) {
        await updateProfileById(profile.id, {
            subscription_status: 'past_due',
        });
        console.warn(`Payment failed for user ${profile.id}, subscription ${subscriptionId}`);
    }
}
