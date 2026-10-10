import { markStripeEventProcessed } from '@/lib/appwrite/server';
import { releaseStripeEvent } from '@/lib/stripe-event-ledger';

// One-time claims share the Stripe idempotency ledger (`stripe_events`, unique `event_id`):
// the first insert of a key wins, every concurrent duplicate gets a 409. Keys are namespaced
// (e.g. `referral-reward:<userId>`) so they never collide with Stripe event ids (`evt_…`).

/** Returns true only for the single caller that claimed `key` first. */
export async function claimOnce(key: string): Promise<boolean> {
  const alreadyClaimed = await markStripeEventProcessed(key);
  return !alreadyClaimed;
}

/** Gives a claim back after the guarded work failed, so it can be retried. Best-effort. */
export async function releaseClaim(key: string): Promise<void> {
  await releaseStripeEvent(key);
}
