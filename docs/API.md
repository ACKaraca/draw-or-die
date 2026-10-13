# Draw or Die — API

## Next.js API Routes

### POST /api/checkout

Creates a Stripe Checkout session.

**Auth:** Valid Appwrite session required (server-side user check)

**Pricing tier:** student tiers come from a verified edu email (`/api/verify-edu`) or from the signup email **only when Appwrite reports it as verified**. Unverified `.edu.tr` signups get the `GLOBAL` tier.

**Body:**
```json
{
  "mode": "premium_monthly" | "premium_yearly" | "rapido_pack",
  "quantity": 5  // only for rapido_pack; integer 5–1000, defaults to 5 when omitted
}
```

**Response (200):**
```json
{ "url": "https://checkout.stripe.com/..." }
```

The existing Stripe customer (`profiles.stripe_customer_id`) is reused. An internal promo use is reserved atomically
before the session is created (`promo_redemptions.status = reserved`), becomes `redeemed` when the webhook confirms
payment, and is `released` on `checkout.session.expired` or if session creation fails. The success redirect
(`?checkout=success`) grants nothing; the client only re-reads the profile.

**Errors:**
- `401` — Authentication required
- `400` — Invalid checkout mode
- `400` — `INVALID_RAPIDO_QUANTITY` (quantity not an integer between 5 and 1000)
- `400` — `PROMO_EXHAUSTED` / `PROMO_USER_LIMIT` (internal promo quota already reserved)
- `409` — `SUBSCRIPTION_ALREADY_ACTIVE` (premium modes: the user/Stripe customer already has an active, trialing, past_due, unpaid or incomplete subscription)
- `429` — Rate limit exceeded
- `503` — Stripe not configured (`STRIPE_SECRET_KEY` missing)
- `500` — Unexpected checkout error

---

### POST /api/webhook/stripe

Stripe webhook endpoint. Configure the URL in the Stripe Dashboard.

**Headers:** `stripe-signature` (Stripe signature header)

**Processing:** each event is claimed in `stripe_events` (`processing → succeeded | ignored | rejected`, or `failed`
with `attempts`/`last_error`). A live lease blocks parallel workers; a failed or stale event is taken over by the next
delivery. Rapido/ledger effects are idempotent per source id (`checkout:<session>`, `invoice:<invoice>`,
`refund:<refund>`, `dispute:<dispute>:<stage>`) and written atomically with the balance change.

**Processed events:**
- `checkout.session.completed` / `checkout.session.async_payment_succeeded` — validated against `lib/pricing.ts`
  (product/price, unit amount, currency, quantity, mode, payment status); then Rapido pack credit or Premium
  activation + allowance top-up to `TIER_DEFAULTS.PREMIUM`. Mismatches are recorded as `rejected` and grant nothing.
- `checkout.session.expired` / `checkout.session.async_payment_failed` — releases an internal promo reservation.
- `customer.subscription.*` and `invoice.payment_failed` — re-read the subscription from Stripe and project its current
  status (`active`/`trialing` on a known Premium price = premium), so out-of-order events converge.
- `invoice.paid` (`billing_reason = subscription_cycle`) — renewal: tops the balance up to the monthly Premium allowance
  once per invoice and records `premium_renewal`. Yearly plans renew yearly, so they get this top-up once per year.
- `charge.refunded` — Rapido pack: revokes the refunded share per refund (clamped at 0, `rapido_pack_refund`).
  Subscription payment: recorded as `premium_refund` only; access follows the subscription status.
- `charge.dispute.created` / `charge.dispute.closed` — recorded; a lost dispute on a Rapido pack revokes the disputed share.
- Anything else — acknowledged and recorded as `ignored`.

**Responses:** `200` processed/duplicate/ignored/rejected · `400` bad signature · `409` another worker holds the lease ·
`500` handler failed (event kept as `failed`, Stripe retries) · `503` paused (`STRIPE_WEBHOOK_PAUSED`) or event store unavailable.

### POST /api/webhook/stripe/replay

Admin-only (verified admin email). Body: `{ "eventIds"?: string[], "dryRun"?: boolean, "includeRejected"?: boolean }`.
Dry-run by default: without ids it lists stored `failed` events; with ids it shows stored state plus the Stripe event.
`dryRun: false` requires explicit ids (max 25), re-fetches each event from Stripe and runs it through the same processor.
CLI wrapper: `scripts/replay-stripe-events.mjs`.

---

### POST /api/gallery

Submit a project to the public gallery or fetch gallery items.

**Auth:** Valid Appwrite JWT required for submissions.

**GET** — Returns paginated gallery items filtered by `gallery_type` (`HALL_OF_FAME | WALL_OF_DEATH | COMMUNITY`).

**POST Body:**
```json
{
  "imageBase64": "string",
  "critiqueData": {},
  "galleryType": "HALL_OF_FAME" | "WALL_OF_DEATH",
  "title": "string"
}
```

**Errors:**
- `401` — Authentication required
- `403` — Submission not eligible
- `429` — Rate limit exceeded

---

### GET/PATCH /api/profile

Read or update the authenticated user's profile.

**Auth:** Valid Appwrite JWT required.

**PATCH Body (partial):**
```json
{
  "display_name": "string",
  "edu_email": "string"
}
```

**Notes:** Security-sensitive fields (`rapido_pens`, `is_premium`, `progression_score`) cannot be mutated via this endpoint — they are managed exclusively by server-side logic.

---

### GET/DELETE /api/analysis-history

Retrieve or soft-delete the authenticated user's analysis history.

**Auth:** Valid Appwrite JWT required.

**GET** — Returns paginated list of `AnalysisHistoryItem` records.

**DELETE** — Soft-deletes a specific analysis by `id`. Deleted items are purgeable after a grace period.

---

### POST /api/analysis-history/recover

Recovers a soft-deleted analysis within the allowed grace period.

**Auth:** Valid Appwrite JWT required.

**Body:**
```json
{ "id": "analysis_id" }
```

---

### GET/POST /api/mentor/chats

Manage AI Mentor chat sessions.

**Auth:** Valid Appwrite JWT + Premium subscription required.

**POST Body:**
```json
{ "title": "string" }
```

---

### GET/POST /api/mentor/chats/[chatId]/messages

Read or send messages in an AI Mentor chat session.

**Auth:** Valid Appwrite JWT + Premium subscription required.

**POST Body:**
```json
{ "content": "string" }
```

**Notes:** Each message deducts `AI_MENTOR` Rapido cost (token-based billing via `lib/mentor-limits.ts`).

---

### POST /api/verify-edu

Initiates educational email verification by sending a confirmation email.

**Auth:** Valid Appwrite JWT required.

**Body:**
```json
{ "edu_email": "string" }
```

**Errors:**
- `400` — Not a recognized `.edu` or `.edu.tr` address
- `409` — Already verified

---

### GET /api/referral/link

Returns the authenticated user's unique referral link.

**Auth:** Valid Appwrite JWT required.

---

### POST /api/referral/apply

Grants the referral bonus to both parties for the referral linked at signup.

**Auth:** Valid Appwrite JWT required.

**Rules:** the reward is only granted to an account with a verified email that is at most 30 days old, and at most once (claimed through the `stripe_events` idempotency ledger, so parallel calls can't pay twice). Linking (`POST /api/referral/link`) requires a non-anonymous account created in the last 7 days.

**Body:**
```json
{ "code": "string" }
```

---

### POST /api/promos/redeem

Redeems a promotional code for Rapido or Premium access.

**Auth:** Valid Appwrite JWT required.

**Body:**
```json
{ "code": "string" }
```

**Errors:**
- `404` — Code not found or expired
- `409` — Code already redeemed

**Concurrency:** each redemption first claims the user's next usage slot and atomically reserves a global use (`used_count` with `max`), so parallel requests can't exceed `max_uses_per_user` / `max_total_uses`. Failed grants roll both back.

---

### POST /api/checkout/validate-promo

Validates a promo code before initiating Stripe Checkout (e.g., for applying a discount).

**Body:**
```json
{ "code": "string", "mode": "premium_monthly" | "premium_yearly" }
```

---

### POST /api/billing/portal

Generates a Stripe Customer Portal URL for managing subscriptions and payment methods.

**Auth:** Valid Appwrite JWT required.

**Response (200):**
```json
{ "url": "https://billing.stripe.com/..." }
```

---

### GET /api/billing/history

Returns the authenticated user's Stripe invoice history.

**Auth:** Valid Appwrite JWT required.

---

### GET /api/health

Basic health check. Returns `200 OK` when the service is operational. Used by uptime monitors and release-parity checks.

**Response (200):**
```json
{
  "status": "ok",
  "service": "draw-or-die",
  "release": {
    "sha": "provider, runtime, or embedded 40-character commit SHA; otherwise unknown",
    "deploymentId": "provider deployment ID or unknown"
  },
  "timestamp": "ISO-8601 timestamp"
}
```

---

### POST /api/growth/conversion

Logs a conversion event for growth analytics.

**Body:**
```json
{
  "event": "string",
  "properties": {}
}
```

---

### POST /api/client-log

Accepts client-side error reports for server-side logging and observability.

**Body:**
```json
{
  "level": "error" | "warn",
  "message": "string",
  "context": {}
}
```

---

### POST /api/feedback

Collects user feedback.

**Body:**
```json
{
  "message": "string",
  "category": "string"
}
```

---

## AI Generation Endpoint

### POST /api/ai-generate

Core AI jury analysis endpoint. Handles authentication, Rapido deduction, LLM proxying, and game-state updates.

**Headers:** `Authorization: Bearer <appwrite_jwt>`

**Body:**
```json
{
  "operation": "SINGLE_JURY" | "PREMIUM_RESCUE" | "REVISION_SAME" | "REVISION_DIFFERENT" | "MULTI_JURY" | "MULTI_JURY_REVISION" | "DEFENSE" | "AI_MENTOR" | "AUTO_CONCEPT" | "MATERIAL_BOARD" | "DRAWING_CONSISTENCY" | "CIRCULATION_ADJACENCY" | "ACCESSIBILITY_EGRESS" | "SKILL_ROADMAP",
  "imageBase64": "base64_encoded_image_data",
  "imageMimeType": "image/jpeg" | "image/png" | "application/pdf",
  "params": {
    "topic": "string",
    "category": "string",
    "harshness": 1-5,
    "pdfText": "string",
    "previousCritique": "string",
    "userMessage": "string",
    "chatHistory": "string",
    "turnCount": 0-3,
    "currentCritique": "string",
    "analysisLength": "SHORT" | "MEDIUM" | "LONG" | "WORD_TARGET",
    "singlePersonaId": "constructive" | "structural" | "conceptual" | "grumpy" | "contextualist" | "sustainability",
    "multiPersonaIds": ["string"]
  }
}
```

**Execution flow:**
1. Validates Appwrite JWT and resolves user ID (validated JWTs are cached per instance for 60 s).
2. Checks operation cost from `lib/pricing.ts`. Returns `402` if balance is insufficient.
3. Checks `PREMIUM_FEATURES` list. Returns `403` if operation requires Premium and user is not subscribed.
4. Applies rate limits per bucket: `analysis` (paid jury/insight operations), `assist` (`AUTO_FILL_FORM`), `chat` (`AI_MENTOR`, `DEFENSE`).
5. Constructs prompt based on `operation`, `params.harshness`, and persona IDs. Uploaded files are always sent to the model; earlier summaries of the same file are added as context.
6. Calls the LLM through `lib/ai-completion.ts` with a strict JSON schema (`lib/ai-response-formats.ts`), a 100 s budget and one retry on transient provider errors.
7. Deducts Rapido atomically (`lib/rapido-balance.ts`) and writes `game_state` in parallel, then returns the result. File-cache and memory-snippet rows are written after the response is sent.

Design insight operations return `{ "critique": "string", "score": number }`. `ACCESSIBILITY_EGRESS` is an advisory visual pre-check, not a code-compliance certification. `SKILL_ROADMAP` combines `currentCritique` with the authenticated user's recent analysis-memory snippets.

**Response (200):**
```json
{
  "result": "string (stringified JSON from LLM)",
  "rapido_remaining": 28,
  "game_state": {
    "progression_score": 150,
    "wall_of_death_count": 0,
    "earned_badges": [],
    "new_badges": []
  }
}
```

**Errors:**
- `401` — Invalid or missing JWT
- `402` — Insufficient Rapido (`INSUFFICIENT_RAPIDO`)
- `403` — Premium required (`PREMIUM_REQUIRED`)
- `429` — Rate limit exceeded (`RATE_LIMITED`, includes `waitSeconds`)
- `502` — AI provider failure (`AI_PROVIDER_FAILURE`) or unusable model output (`INVALID_AI_RESULT`); Rapido is not charged
- `503` — `AI_API_KEY` not configured, or provider credits restricted (`AI_PROVIDER_CREDITS_REQUIRED`)
- `500` — Unexpected processing error (generic localized message + `requestId`; details only in server logs)
