import Stripe from 'stripe';

export const STRIPE_API_VERSION = '2026-02-25.clover';

let cachedStripe: Stripe | null = null;

/** Server-only Stripe client built from `STRIPE_SECRET_KEY`. Throws when the key is missing. */
export function getStripeServerClient(): Stripe {
  if (!cachedStripe) {
    const key = (process.env.STRIPE_SECRET_KEY ?? '').replace(/[\r\n\s"']/g, '').trim();
    if (!key) {
      throw new Error('MISSING_STRIPE_SECRET_KEY');
    }
    cachedStripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  }
  return cachedStripe;
}

export function getStripeWebhookSecret(): string {
  return (process.env.STRIPE_WEBHOOK_SECRET ?? '').replace(/[\r\n\s"']/g, '').trim();
}

/** Ops kill switch: while set, webhook deliveries get 503 and Stripe keeps retrying them. */
export function isStripeWebhookPaused(): boolean {
  return (process.env.STRIPE_WEBHOOK_PAUSED ?? '').trim().toLowerCase() === 'true';
}
