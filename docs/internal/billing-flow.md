# Billing & Stripe Flow Architecture

This document outlines the end-to-end lifecycle of billing and subscriptions in the application, including checkout generation, promo validation, webhook syncing, and historical tracking.

## 1. Checkout Flow (`app/api/checkout/route.ts`)

The system establishes Stripe Checkout Sessions tailored to user profiles, chosen products, and active promotions.

### Supported Modes
- `premium_monthly`: Recurring monthly subscription for Premium features.
- `premium_yearly`: Recurring yearly subscription for Premium features.
- `rapido_pack`: One-time purchase of a specified quantity of Rapido Pens.

### Tiered Pricing
The pricing tier is automatically evaluated from the user's email domain or verified educational email (`lib/pricing.ts`).
1. **`AKDENIZ_STUDENT`**: Applied for `@akdeniz.edu.tr` or `*.akdeniz.edu.tr` emails.
2. **`TR_STUDENT`**: Applied for any other `.edu.tr` emails.
3. **`GLOBAL`**: Default tier for any standard domain (e.g., `gmail.com`).

Stripe Price IDs and Currencies (`try` vs `usd`) change dynamically based on these tiers.

### Line Item Construction
- **Subscriptions**: Handled via `checkoutMode = 'subscription'`. Maps to exact Stripe recurring Price IDs.
- **Rapido Packs**: Handled via `checkoutMode = 'payment'`. The minimum purchase amount is 5 Rapidos. Maps to a per-unit Rapido price multiplied by the requested quantity.
- **Internal Promos**: If an internal discount code is provided, dynamic line items are generated matching the discounted `unit_amount` instead of the rigid catalog Price IDs.

## 2. Promo Validation (`app/api/checkout/validate-promo/route.ts`)

Promotions can originate directly from our internal Appwrite-backed system or natively from Stripe.

### Internal Promo Rules
Evaluated heavily by `validatePromoForCheckout()` in `lib/promo-codes.ts`:
- **Scope Verification**: Ensures the user meets conditions (e.g., `guest`, `registered`, `premium`, `edu`, `akdeniz`).
- **Checkout Mode Verification**: Validates if the code applies to `premium_monthly`, `premium_yearly`, or `rapido_pack`.
- **Usage Limits**: Checks total usage limits globally or per user based on previous claims.

### Stripe Promo Codes
If an internal promo isn't found, the code verifies the identifier against `stripe.promotionCodes.list()`. Valid native Stripe codes are attached to the checkout session via `allow_promotion_codes` or `discounts` arrays.

## 3. Webhook Events & Idempotency (`app/api/webhook/stripe/route.ts`)

Incoming webhooks map Stripe activity to Appwrite Profile state changes. Webhooks are strictly checked via `stripe-signature` to ensure payload integrity.

### Idempotency
Processed event identifiers are stored inside the `stripe_events` table. If a duplicate `event.id` arrives, it is bypassed, ensuring multiple hook replays do not inflate balances or duplicate subscription states.

### Processed Event Types
- `checkout.session.completed`: Provisions initial subscriptions and rapido packs upon successful payment. Captures important session metadata (UTM tags, conversion metrics).
- `customer.subscription.created` / `customer.subscription.updated`: Syncs real-time state changes for subscriptions (e.g., renewing, trialing, canceling).
- `customer.subscription.deleted`: Drops premium status immediately upon cancellation completion.
- `invoice.payment_failed`: Transitions profile `subscription_status` to `past_due`.

## 4. Profile Sync Fields (`lib/appwrite/server.ts`)

Financial state is aggressively synced down to Appwrite's `profiles` table to minimize API calls to Stripe on every frontend render. Key fields:

- `is_premium`: `boolean` tracking active premium state.
- `rapido_pens`: User's current balance of standard Rapido usage tokens.
- `stripe_customer_id`: Mapped to Stripe Customer object.
- `stripe_subscription_id`: Mapped to active Stripe Subscription.
- `subscription_status`: `active`, `canceled`, `past_due`, `trialing`, etc.
- `subscription_current_period_start` / `subscription_current_period_end`: Current billing period timestamps.
- `subscription_cancel_at_period_end`: Tracks if a user requested cancellation but still has active time remaining.
- `premium_interval`: `month` or `year`.
- `premium_promo_code`: Tracks the code used to acquire the active subscription.

## 5. Portal Management (`app/api/billing/portal/route.ts`)

Users can self-manage subscriptions via Stripe Billing Portal.
1. Authenticates current Appwrite user.
2. Looks up the mapped `stripe_customer_id` from their profile.
3. Generates a secure `stripe.billingPortal.sessions.create` URL to safely route them out to Stripe.

## 6. Billing History Semantics

We maintain two separated ledgers inside the Appwrite database (`lib/appwrite/resource-bootstrap.ts`):

- **`stripe_events`**: A purely infrastructural table for ensuring hook idempotency. Contains raw `event_id` and `processed_at`.
- **`billing_events`**: A human and analytics-readable audit log tracking actionable financial changes. Written via `recordBillingEvent()`. Contains:
  - `event_type`: (e.g., `premium_monthly`, `rapido_pack`, `promo_redemption_premium`).
  - `amount_cents` & `currency`.
  - `rapido_delta` & `rapido_balance_after`: Precise ledger of Rapido mutations resulting from a transaction.
  - Linked `stripe_session_id`, `stripe_customer_id`, `stripe_subscription_id` and arbitrary `metadata_json`.
