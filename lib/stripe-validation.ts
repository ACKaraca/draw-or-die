import type Stripe from 'stripe';

import { STRIPE_PRICES, type StripeTierKey } from '@/lib/pricing';

/**
 * Pure checks that decide whether a verified Stripe object may grant anything.
 * Every value is compared against `lib/pricing.ts`; nothing here trusts client input.
 */

export type CheckoutPurchaseMode = 'rapido_pack' | 'premium_monthly' | 'premium_yearly';

export type CheckoutGrant =
  | { kind: 'rapido_pack'; userId: string; tier: StripeTierKey; quantity: number }
  | { kind: 'premium'; userId: string; tier: StripeTierKey; mode: 'premium_monthly' | 'premium_yearly' };

export type CheckoutValidation =
  | { ok: true; grant: CheckoutGrant }
  | { ok: false; kind: 'pending'; reason: string }
  | { ok: false; kind: 'rejected'; reason: string };

export type EventContextValidation = { ok: true } | { ok: false; reason: string };

const TIER_KEYS: readonly StripeTierKey[] = ['AKDENIZ_STUDENT', 'TR_STUDENT', 'GLOBAL'];
const ENTITLING_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

function readEnv(name: string): string {
  const raw = process.env[name];
  return typeof raw === 'string' ? raw.replace(/[\r\n\s"']/g, '').trim() : '';
}

/**
 * `STRIPE_EXPECTED_LIVEMODE` (`true`/`false`) wins; otherwise the mode follows the secret key
 * prefix. Returns null when it cannot be determined (no check is applied then).
 */
export function resolveExpectedLivemode(): boolean | null {
  const explicit = readEnv('STRIPE_EXPECTED_LIVEMODE').toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;

  const key = readEnv('STRIPE_SECRET_KEY');
  if (/^[rs]k_live_/.test(key)) return true;
  if (/^[rs]k_test_/.test(key)) return false;
  return null;
}

/**
 * Rejects events from the wrong mode and Connect events from any account other than
 * `STRIPE_ACCOUNT_ID`. Direct (non-Connect) events carry no `account` and are accepted.
 */
export function validateEventContext(event: Pick<Stripe.Event, 'livemode' | 'account'>): EventContextValidation {
  const expectedLivemode = resolveExpectedLivemode();
  if (expectedLivemode !== null && event.livemode !== expectedLivemode) {
    return { ok: false, reason: 'livemode_mismatch' };
  }

  const eventAccount = typeof event.account === 'string' ? event.account : '';
  if (eventAccount) {
    const expectedAccount = readEnv('STRIPE_ACCOUNT_ID');
    if (!expectedAccount || eventAccount !== expectedAccount) {
      return { ok: false, reason: 'account_mismatch' };
    }
  }

  return { ok: true };
}

export function isStripeTierKey(value: unknown): value is StripeTierKey {
  return typeof value === 'string' && (TIER_KEYS as readonly string[]).includes(value);
}

function getProductId(price: Stripe.Price): string {
  const product = price.product;
  if (typeof product === 'string') return product;
  return product && typeof product === 'object' && 'id' in product ? String(product.id) : '';
}

function expectedRapidoPrice(tier: StripeTierKey): { priceId: string; productId: string; unitAmount: number } {
  const config = STRIPE_PRICES[tier];
  return { priceId: config.PRICE_IDS.RAPIDO, productId: STRIPE_PRICES.RAPIDO_PRODUCT_ID, unitAmount: config.RAPIDO_UNIT };
}

function expectedPremiumPrice(
  tier: StripeTierKey,
  mode: 'premium_monthly' | 'premium_yearly',
): { priceId: string; productId: string; unitAmount: number; interval: 'month' | 'year' } {
  const config = STRIPE_PRICES[tier];
  const isMonthly = mode === 'premium_monthly';
  return {
    priceId: isMonthly ? config.PRICE_IDS.MONTHLY : config.PRICE_IDS.YEARLY,
    productId: config.PRODUCT_ID,
    unitAmount: isMonthly ? config.MONTHLY : config.YEARLY,
    interval: isMonthly ? 'month' : 'year',
  };
}

/** True when the price is one of the configured Premium prices (or an ad-hoc price on a Premium product). */
export function isKnownPremiumPrice(price: Stripe.Price | null | undefined): boolean {
  if (!price) return false;
  const productId = getProductId(price);
  return TIER_KEYS.some((tier) => {
    const config = STRIPE_PRICES[tier];
    return price.id === config.PRICE_IDS.MONTHLY
      || price.id === config.PRICE_IDS.YEARLY
      || (productId === config.PRODUCT_ID && Boolean(price.recurring));
  });
}

export function isEntitlingSubscriptionStatus(status: string | null | undefined): boolean {
  return ENTITLING_SUBSCRIPTION_STATUSES.has(status ?? '');
}

function parseInteger(raw: string | undefined): number | null {
  if (typeof raw !== 'string' || !/^\d{1,9}$/.test(raw.trim())) return null;
  return Number.parseInt(raw.trim(), 10);
}

/**
 * Validates a completed Checkout Session plus its line items against the pricing table.
 * `pending` means the session is complete but an async payment has not cleared yet.
 */
export function validateCheckoutSession(
  session: Stripe.Checkout.Session,
  lineItems: readonly Stripe.LineItem[],
): CheckoutValidation {
  const reject = (reason: string): CheckoutValidation => ({ ok: false, kind: 'rejected', reason });
  const metadata = session.metadata ?? {};
  const userId = (metadata.user_id ?? '').trim();
  const mode = metadata.checkout_mode as CheckoutPurchaseMode | undefined;

  if (!userId) return reject('missing_user');
  if (session.client_reference_id && session.client_reference_id !== userId) return reject('user_mismatch');
  if (mode !== 'rapido_pack' && mode !== 'premium_monthly' && mode !== 'premium_yearly') {
    return reject('unknown_checkout_mode');
  }

  const expectedSessionMode = mode === 'rapido_pack' ? 'payment' : 'subscription';
  if (session.mode !== expectedSessionMode) return reject('session_mode_mismatch');
  if (session.status && session.status !== 'complete') return reject('session_not_complete');

  const isPaid = session.payment_status === 'paid'
    || (mode !== 'rapido_pack' && session.payment_status === 'no_payment_required');
  if (!isPaid) {
    return session.payment_status === 'unpaid'
      ? { ok: false, kind: 'pending', reason: 'awaiting_async_payment' }
      : reject('payment_not_settled');
  }

  const tier = metadata.pricing_tier;
  if (!isStripeTierKey(tier)) return reject('unknown_pricing_tier');
  const currency = (session.currency ?? '').toLowerCase();
  if (currency !== STRIPE_PRICES[tier].CURRENCY) return reject('currency_mismatch');

  if (lineItems.length !== 1) return reject('unexpected_line_items');
  const [item] = lineItems;
  const price = item.price;
  if (!price) return reject('missing_price');
  if ((item.currency ?? '').toLowerCase() !== currency || (price.currency ?? '').toLowerCase() !== currency) {
    return reject('currency_mismatch');
  }

  const isInternalPromo = metadata.promo_source === 'internal';
  if (isInternalPromo && (session.total_details?.amount_discount ?? 0) > 0) {
    // An internal promo is priced into the line item; a Stripe discount on top would stack.
    return reject('double_discount');
  }

  const expected = mode === 'rapido_pack' ? expectedRapidoPrice(tier) : expectedPremiumPrice(tier, mode);
  const isExpectedPrice = price.id === expected.priceId || getProductId(price) === expected.productId;
  if (!isExpectedPrice) return reject('price_mismatch');

  if (mode !== 'rapido_pack') {
    const premium = expected as ReturnType<typeof expectedPremiumPrice>;
    if (price.recurring?.interval !== premium.interval) return reject('interval_mismatch');
  }

  const quantity = item.quantity ?? 0;
  const unitAmount = price.unit_amount ?? -1;
  let expectedUnitAmount = expected.unitAmount;
  if (isInternalPromo) {
    const discounted = parseInteger(metadata.expected_unit_amount);
    if (discounted === null || discounted > expected.unitAmount) return reject('promo_amount_mismatch');
    expectedUnitAmount = discounted;
  }
  if (unitAmount !== expectedUnitAmount) return reject('amount_mismatch');
  if (item.amount_subtotal !== unitAmount * quantity) return reject('amount_mismatch');
  if (typeof session.amount_total === 'number' && session.amount_total > item.amount_subtotal) {
    return reject('amount_mismatch');
  }

  if (mode === 'rapido_pack') {
    const metadataQuantity = parseInteger(metadata.rapido_quantity);
    if (
      metadataQuantity === null
      || quantity !== metadataQuantity
      || quantity < STRIPE_PRICES.MIN_RAPIDO_PURCHASE
      || quantity > STRIPE_PRICES.MAX_RAPIDO_PURCHASE
    ) {
      return reject('quantity_mismatch');
    }
    return { ok: true, grant: { kind: 'rapido_pack', userId, tier, quantity } };
  }

  if (quantity !== 1) return reject('quantity_mismatch');
  return { ok: true, grant: { kind: 'premium', userId, tier, mode } };
}
