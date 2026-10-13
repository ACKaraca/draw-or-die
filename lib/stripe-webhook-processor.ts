import { Query } from 'node-appwrite';
import type Stripe from 'stripe';

import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_PROFILES_ID,
  findProfileBySubscriptionId,
  getAdminTables,
  getOrCreateProfile,
  normalizeProfileRow,
  type NormalizedUserProfile,
  type UserProfileRow,
} from '@/lib/appwrite/server';
import { logServerError, logServerInfo } from '@/lib/logger';
import { TIER_DEFAULTS } from '@/lib/pricing';
import { confirmCheckoutPromoReservation, releaseCheckoutPromoReservation } from '@/lib/promo-codes';
import { applyEntitlementEffect } from '@/lib/stripe-entitlements';
import {
  claimStripeEvent,
  completeStripeEvent,
  describeError,
  failStripeEvent,
} from '@/lib/stripe-event-ledger';
import {
  isEntitlingSubscriptionStatus,
  isKnownPremiumPrice,
  validateCheckoutSession,
  validateEventContext,
  type CheckoutGrant,
} from '@/lib/stripe-validation';

export type ProcessedOutcome = {
  status: 'succeeded' | 'ignored' | 'rejected';
  outcome: string;
};

export type StripeEventHandleResult =
  | { kind: 'duplicate'; status: string }
  | { kind: 'busy' }
  | { kind: 'processed'; status: ProcessedOutcome['status']; outcome: string; attempt: number }
  | { kind: 'failed'; error: string; attempt: number };

type HandleOptions = {
  /** Replay tool only: allows re-running an event that was previously rejected. */
  allowRejected?: boolean;
};

const succeeded = (outcome: string): ProcessedOutcome => ({ status: 'succeeded', outcome });
const ignored = (outcome: string): ProcessedOutcome => ({ status: 'ignored', outcome });
const rejected = (outcome: string): ProcessedOutcome => ({ status: 'rejected', outcome });

/**
 * Processes one signature-verified Stripe event exactly once in effect: claim (lease) →
 * validate → idempotent effects → record the final state. A thrown error leaves the event
 * `failed` so Stripe's retry or the replay tool can process it again.
 * Errors from the claim itself propagate so the caller can fail closed.
 */
export async function handleStripeEvent(
  event: Stripe.Event,
  stripe: Stripe,
  options: HandleOptions = {},
): Promise<StripeEventHandleResult> {
  const claimResult = await claimStripeEvent(
    { id: event.id, type: event.type, livemode: event.livemode, created: event.created },
    { allowRejected: options.allowRejected },
  );
  if (claimResult.kind === 'duplicate') return { kind: 'duplicate', status: claimResult.status };
  if (claimResult.kind === 'busy') return { kind: 'busy' };

  const { claim } = claimResult;
  try {
    const result = await processEvent(event, stripe);
    await completeStripeEvent(claim, result.status, result.outcome);
    if (result.status === 'rejected') {
      logServerError('webhook.stripe.rejected', new Error(result.outcome), { eventId: event.id, eventType: event.type });
    }
    return { kind: 'processed', status: result.status, outcome: result.outcome, attempt: claim.attempt };
  } catch (error) {
    logServerError('webhook.stripe.handler', error, { eventId: event.id, eventType: event.type, attempt: claim.attempt });
    await failStripeEvent(claim, error);
    return { kind: 'failed', error: describeError(error), attempt: claim.attempt };
  }
}

async function processEvent(event: Stripe.Event, stripe: Stripe): Promise<ProcessedOutcome> {
  const context = validateEventContext(event);
  if (!context.ok) return rejected(context.reason);

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return handleCheckoutPaid(event.data.object, stripe);
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed':
      return handleCheckoutAbandoned(event.data.object);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
      return (await syncSubscription(event.data.object.id, stripe)).outcome;
    case 'invoice.paid':
      return handleInvoicePaid(event.data.object, stripe);
    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(event.data.object, stripe);
    case 'charge.refunded':
      return handleChargeRefunded(event.data.object, stripe);
    case 'charge.dispute.created':
    case 'charge.dispute.closed':
      return handleDispute(event.data.object, stripe);
    default:
      return ignored('unhandled_event_type');
  }
}

function toIsoFromUnix(value: number | null | undefined): string {
  if (!Number.isFinite(value) || !value) return '';
  return new Date(Number(value) * 1000).toISOString();
}

function asId(value: string | { id: string } | null | undefined): string {
  if (typeof value === 'string') return value;
  return value && typeof value === 'object' && 'id' in value ? String(value.id) : '';
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

async function handleCheckoutPaid(session: Stripe.Checkout.Session, stripe: Stripe): Promise<ProcessedOutcome> {
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
  const validation = validateCheckoutSession(session, lineItems.data);
  if (!validation.ok) {
    if (validation.kind === 'pending') return succeeded(validation.reason);
    await recordRejectedCheckout(session, validation.reason);
    return rejected(validation.reason);
  }

  const reservationId = (session.metadata?.promo_reservation_id ?? '').trim();
  if (reservationId) {
    await confirmCheckoutPromoReservation(reservationId, session.id);
  }

  const { grant } = validation;
  return grant.kind === 'rapido_pack'
    ? grantRapidoPack(session, grant)
    : grantPremiumCheckout(session, grant, stripe);
}

async function recordRejectedCheckout(session: Stripe.Checkout.Session, reason: string): Promise<void> {
  const userId = (session.metadata?.user_id ?? '').trim();
  if (!userId) return;
  const profile = await getOrCreateProfile({ id: userId, email: null, name: null });
  await applyEntitlementEffect({
    kind: 'ledger',
    sourceKey: `checkout:${session.id}:rejected`,
    userId,
    profileRowId: profile.row_id ?? null,
    knownBalance: profile.rapido_pens,
    rapidoDelta: 0,
    entry: {
      eventType: 'checkout_rejected',
      // Audit-only rows keep amount_cents at 0 so billing history totals never count them.
      amountCents: 0,
      currency: session.currency ?? 'try',
      stripeSessionId: session.id,
      stripeCustomerId: asId(session.customer) || null,
      metadata: { reason, checkoutMode: session.metadata?.checkout_mode ?? null, sessionAmountCents: session.amount_total ?? 0 },
    },
  });
}

function checkoutLedgerMetadata(session: Stripe.Checkout.Session): Record<string, unknown> {
  return {
    pricingTier: session.metadata?.pricing_tier ?? null,
    promoCode: session.metadata?.promo_code ?? null,
    promotionCodeId: session.metadata?.promotion_code_id ?? null,
    promoSource: session.metadata?.promo_source ?? null,
    paymentIntentId: asId(session.payment_intent) || null,
  };
}

async function grantRapidoPack(
  session: Stripe.Checkout.Session,
  grant: Extract<CheckoutGrant, { kind: 'rapido_pack' }>,
): Promise<ProcessedOutcome> {
  const profile = await getOrCreateProfile({ id: grant.userId, email: null, name: null });
  const result = await applyEntitlementEffect({
    kind: 'ledger',
    sourceKey: `checkout:${session.id}:rapido_pack`,
    userId: grant.userId,
    profileRowId: profile.row_id ?? null,
    knownBalance: profile.rapido_pens,
    rapidoDelta: grant.quantity,
    entry: {
      eventType: 'rapido_pack',
      amountCents: session.amount_total ?? 0,
      currency: session.currency ?? 'try',
      stripeSessionId: session.id,
      stripeCustomerId: asId(session.customer) || null,
      metadata: checkoutLedgerMetadata(session),
    },
  });
  return succeeded(result.applied ? 'rapido_pack_granted' : 'rapido_pack_already_granted');
}

async function grantPremiumCheckout(
  session: Stripe.Checkout.Session,
  grant: Extract<CheckoutGrant, { kind: 'premium' }>,
  stripe: Stripe,
): Promise<ProcessedOutcome> {
  const subscriptionId = asId(session.subscription);
  if (!subscriptionId) return rejected('missing_subscription');

  const profile = await getOrCreateProfile({ id: grant.userId, email: null, name: null });
  // Link first so the subscription sync below (and any later subscription event) finds the user.
  await applyEntitlementEffect({
    kind: 'subscription_state',
    userId: grant.userId,
    patch: {
      stripe_customer_id: asId(session.customer),
      stripe_subscription_id: subscriptionId,
      premium_started_at: toIsoFromUnix(session.created) || new Date().toISOString(),
      premium_price_cents: Math.max(0, Math.floor(session.amount_total ?? 0)),
      premium_currency: (session.currency ?? 'try').toLowerCase(),
      premium_interval: grant.mode === 'premium_yearly' ? 'year' : 'month',
      premium_promo_code: (session.metadata?.promo_code ?? '').trim().substring(0, 64),
    },
  });

  // The paid first period grants the allowance whatever the subscription's state is now,
  // so the result does not depend on whether a later cancel arrived first.
  const allowance = await applyEntitlementEffect({
    kind: 'ledger',
    sourceKey: `checkout:${session.id}:premium_allowance`,
    userId: grant.userId,
    profileRowId: profile.row_id ?? null,
    knownBalance: profile.rapido_pens,
    rapidoDelta: Math.max(0, TIER_DEFAULTS.PREMIUM - profile.rapido_pens),
    entry: {
      eventType: grant.mode,
      amountCents: session.amount_total ?? 0,
      currency: session.currency ?? 'try',
      stripeSessionId: session.id,
      stripeCustomerId: asId(session.customer) || null,
      stripeSubscriptionId: subscriptionId,
      metadata: checkoutLedgerMetadata(session),
    },
  });

  const sync = await syncSubscription(subscriptionId, stripe);

  if (allowance.applied) {
    logServerInfo('growth-conversion', {
      eventName: 'conversion_to_paid',
      userId: grant.userId,
      checkoutMode: grant.mode,
      stripeSessionId: session.id,
      utm_source: session.metadata?.utm_source ?? null,
      utm_medium: session.metadata?.utm_medium ?? null,
      utm_campaign: session.metadata?.utm_campaign ?? null,
    });
  }

  if (sync.outcome.status === 'rejected') return sync.outcome;
  return succeeded(allowance.applied ? 'premium_granted' : 'premium_already_granted');
}

async function handleCheckoutAbandoned(session: Stripe.Checkout.Session): Promise<ProcessedOutcome> {
  const reservationId = (session.metadata?.promo_reservation_id ?? '').trim();
  if (!reservationId) return succeeded('no_promo_reservation');
  const result = await releaseCheckoutPromoReservation(reservationId);
  return succeeded(result === 'released' ? 'promo_reservation_released' : 'promo_reservation_unchanged');
}

// ---------------------------------------------------------------------------
// Subscriptions and invoices
// ---------------------------------------------------------------------------

type SubscriptionSync = {
  outcome: ProcessedOutcome;
  profile: NormalizedUserProfile | null;
  subscription: Stripe.Subscription;
};

/**
 * Projects Stripe's *current* subscription onto the profile. The object is always fetched
 * fresh, so duplicate and out-of-order events converge on the same state.
 */
async function syncSubscription(subscriptionId: string, stripe: Stripe): Promise<SubscriptionSync> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const profile = await findProfileBySubscriptionId(subscription.id);
  if (!profile) {
    return { outcome: succeeded('subscription_unlinked'), profile: null, subscription };
  }

  const firstItem = subscription.items?.data?.[0];
  const isKnownPrice = isKnownPremiumPrice(firstItem?.price);
  const isEntitled = isKnownPrice && isEntitlingSubscriptionStatus(subscription.status);

  await applyEntitlementEffect({
    kind: 'subscription_state',
    userId: profile.id,
    patch: {
      is_premium: isEntitled,
      subscription_status: (subscription.status ?? '').substring(0, 32),
      subscription_current_period_start: toIsoFromUnix(firstItem?.current_period_start),
      subscription_current_period_end: toIsoFromUnix(firstItem?.current_period_end),
      subscription_cancel_at_period_end: subscription.cancel_at_period_end === true,
      premium_interval: firstItem?.price?.recurring?.interval || profile.premium_interval || '',
    },
  });

  if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    await applyEntitlementEffect({
      kind: 'ledger',
      sourceKey: `subscription:${subscription.id}:ended`,
      userId: profile.id,
      profileRowId: profile.row_id ?? null,
      knownBalance: profile.rapido_pens,
      rapidoDelta: 0,
      entry: {
        eventType: 'premium_ended',
        amountCents: 0,
        currency: subscription.currency ?? 'try',
        stripeCustomerId: asId(subscription.customer) || null,
        stripeSubscriptionId: subscription.id,
        metadata: { status: subscription.status, endedAt: toIsoFromUnix(subscription.ended_at) || null },
      },
    });
  }

  if (!isKnownPrice) {
    return { outcome: rejected('unknown_subscription_price'), profile, subscription };
  }
  return { outcome: succeeded(`subscription_${subscription.status}`), profile, subscription };
}

/** Stripe moved the subscription reference to `parent.subscription_details` in newer API versions. */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string {
  const legacy = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
  const fromParent = invoice.parent?.subscription_details?.subscription;
  return asId(fromParent ?? legacy ?? null);
}

/**
 * Renewal invoices top the balance up to the monthly Premium allowance. The first invoice
 * is skipped because checkout.session.completed already granted it.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice, stripe: Stripe): Promise<ProcessedOutcome> {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return ignored('not_subscription_invoice');

  const sync = await syncSubscription(subscriptionId, stripe);
  if (invoice.billing_reason !== 'subscription_cycle') return succeeded(`invoice_${invoice.billing_reason ?? 'other'}`);
  if (!sync.profile) return succeeded('subscription_unlinked');
  if (sync.outcome.status === 'rejected') return sync.outcome;
  if (invoice.status !== 'paid') return rejected('invoice_not_paid');
  if ((invoice.currency ?? '').toLowerCase() !== (sync.subscription.currency ?? '').toLowerCase()) {
    return rejected('currency_mismatch');
  }

  const profile = sync.profile;
  const result = await applyEntitlementEffect({
    kind: 'ledger',
    sourceKey: `invoice:${invoice.id}:premium_allowance`,
    userId: profile.id,
    profileRowId: profile.row_id ?? null,
    knownBalance: profile.rapido_pens,
    rapidoDelta: Math.max(0, TIER_DEFAULTS.PREMIUM - profile.rapido_pens),
    entry: {
      eventType: 'premium_renewal',
      amountCents: invoice.amount_paid ?? 0,
      currency: invoice.currency ?? 'try',
      stripeCustomerId: asId(invoice.customer) || null,
      stripeSubscriptionId: subscriptionId,
      metadata: { invoiceId: invoice.id ?? null },
    },
  });
  return succeeded(result.applied ? 'renewal_allowance_granted' : 'renewal_allowance_already_granted');
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, stripe: Stripe): Promise<ProcessedOutcome> {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return ignored('not_subscription_invoice');
  const sync = await syncSubscription(subscriptionId, stripe);
  if (sync.profile) {
    logServerInfo('webhook.stripe.payment-failed', { userId: sync.profile.id, subscriptionId });
  }
  return sync.outcome;
}

// ---------------------------------------------------------------------------
// Refunds and disputes
// ---------------------------------------------------------------------------

type ChargeOrigin =
  | { kind: 'rapido_pack'; userId: string; quantity: number; sessionId: string }
  | { kind: 'subscription_or_unknown'; profile: NormalizedUserProfile | null };

async function findProfileByCustomerId(customerId: string): Promise<NormalizedUserProfile | null> {
  if (!customerId) return null;
  const rows = await getAdminTables().listRows<UserProfileRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_PROFILES_ID,
    queries: [Query.equal('stripe_customer_id', customerId), Query.limit(1)],
  });
  return rows.rows[0] ? normalizeProfileRow(rows.rows[0]) : null;
}

async function resolveChargeOrigin(charge: Stripe.Charge, stripe: Stripe): Promise<ChargeOrigin> {
  const paymentIntentId = asId(charge.payment_intent);
  if (paymentIntentId) {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
    const session = sessions.data[0];
    const quantity = Number.parseInt(session?.metadata?.rapido_quantity ?? '', 10);
    const userId = (session?.metadata?.user_id ?? '').trim();
    if (session && session.metadata?.checkout_mode === 'rapido_pack' && userId && Number.isFinite(quantity)) {
      return { kind: 'rapido_pack', userId, quantity, sessionId: session.id };
    }
  }
  return { kind: 'subscription_or_unknown', profile: await findProfileByCustomerId(asId(charge.customer)) };
}

/** Rapido to take back for `amount` out of the charge, proportional to the purchased pack. */
function proportionalRapido(quantity: number, amount: number, chargeAmount: number): number {
  if (chargeAmount <= 0 || amount <= 0) return 0;
  if (amount >= chargeAmount) return quantity;
  return Math.floor((quantity * amount) / chargeAmount);
}

async function recordValueReversal(options: {
  origin: ChargeOrigin;
  sourceKey: string;
  charge: Stripe.Charge;
  amount: number;
  rapidoEventType: string;
  premiumEventType: string;
  revokeRapido: boolean;
  metadata: Record<string, unknown>;
}): Promise<'recorded' | 'already_recorded' | 'unlinked'> {
  const { origin, charge } = options;
  if (origin.kind === 'rapido_pack') {
    const profile = await getOrCreateProfile({ id: origin.userId, email: null, name: null });
    const requested = options.revokeRapido ? proportionalRapido(origin.quantity, options.amount, charge.amount) : 0;
    const result = await applyEntitlementEffect({
      kind: 'ledger',
      sourceKey: options.sourceKey,
      userId: origin.userId,
      profileRowId: profile.row_id ?? null,
      knownBalance: profile.rapido_pens,
      rapidoDelta: -requested,
      entry: {
        eventType: options.rapidoEventType,
        // amount_cents is summed as spend by billing history; the reversed amount lives in metadata.
        amountCents: 0,
        currency: charge.currency,
        stripeSessionId: origin.sessionId,
        stripeCustomerId: asId(charge.customer) || null,
        metadata: { ...options.metadata, chargeId: charge.id, reversedAmountCents: options.amount, requestedRevocation: requested },
      },
    });
    return result.applied ? 'recorded' : 'already_recorded';
  }

  // Subscription payments: access follows the subscription status (cancel/expiry), so a
  // refund or dispute is recorded for review without changing access or the balance.
  const profile = origin.profile;
  if (!profile) return 'unlinked';
  const result = await applyEntitlementEffect({
    kind: 'ledger',
    sourceKey: options.sourceKey,
    userId: profile.id,
    profileRowId: profile.row_id ?? null,
    knownBalance: profile.rapido_pens,
    rapidoDelta: 0,
    entry: {
      eventType: options.premiumEventType,
      amountCents: 0,
      currency: charge.currency,
      stripeCustomerId: asId(charge.customer) || null,
      stripeSubscriptionId: profile.stripe_subscription_id,
      metadata: { ...options.metadata, chargeId: charge.id, reversedAmountCents: options.amount },
    },
  });
  return result.applied ? 'recorded' : 'already_recorded';
}

async function handleChargeRefunded(charge: Stripe.Charge, stripe: Stripe): Promise<ProcessedOutcome> {
  const origin = await resolveChargeOrigin(charge, stripe);
  const refunds = await stripe.refunds.list({ charge: charge.id, limit: 100 });
  let recorded = 0;
  let unlinked = 0;

  // One effect per refund object: partial refunds and redelivered events each apply once.
  for (const refund of refunds.data) {
    if (refund.status !== 'succeeded') continue;
    const result = await recordValueReversal({
      origin,
      sourceKey: `refund:${refund.id}`,
      charge,
      amount: refund.amount,
      rapidoEventType: 'rapido_pack_refund',
      premiumEventType: 'premium_refund',
      revokeRapido: true,
      metadata: { refundId: refund.id },
    });
    if (result === 'recorded') recorded += 1;
    if (result === 'unlinked') unlinked += 1;
  }

  if (unlinked > 0) return succeeded('refund_unlinked');
  return succeeded(recorded > 0 ? 'refund_recorded' : 'refund_already_recorded');
}

/**
 * Opening a dispute is recorded only (access is preserved during the investigation).
 * A lost dispute revokes the disputed share of a Rapido pack.
 */
async function handleDispute(dispute: Stripe.Dispute, stripe: Stripe): Promise<ProcessedOutcome> {
  const charge = typeof dispute.charge === 'string'
    ? await stripe.charges.retrieve(dispute.charge)
    : dispute.charge;
  const origin = await resolveChargeOrigin(charge, stripe);
  const isLost = dispute.status === 'lost';
  const isClosed = isLost || dispute.status === 'won' || dispute.status === 'warning_closed';
  const stage = isClosed ? `closed_${dispute.status}` : 'opened';

  const result = await recordValueReversal({
    origin,
    sourceKey: `dispute:${dispute.id}:${stage}`,
    charge,
    amount: dispute.amount,
    rapidoEventType: isLost ? 'rapido_pack_dispute_lost' : `rapido_pack_dispute_${isClosed ? dispute.status : 'opened'}`,
    premiumEventType: `premium_dispute_${isClosed ? dispute.status : 'opened'}`,
    revokeRapido: isLost,
    metadata: { disputeId: dispute.id, disputeStatus: dispute.status, reason: dispute.reason },
  });
  return succeeded(result === 'unlinked' ? 'dispute_unlinked' : `dispute_${stage}`);
}
