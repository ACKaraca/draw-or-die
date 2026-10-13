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

**Errors:**
- `401` — Authentication required
- `400` — Invalid checkout mode
- `400` — `INVALID_RAPIDO_QUANTITY` (quantity not an integer between 5 and 1000)
- `429` — Rate limit exceeded
- `503` — Stripe not configured (`STRIPE_SECRET_KEY` missing)
- `500` — Unexpected checkout error

---

### POST /api/webhook/stripe

Stripe webhook endpoint. Configure the URL in the Stripe Dashboard.

**Headers:** `stripe-signature` (Stripe signature header)

**Processed events:**
- `checkout.session.completed` — Premium activation or Rapido top-up
- `customer.subscription.deleted` — Premium cancellation
- `invoice.payment_failed` — Marks the subscription `past_due`
- `invoice.paid` (`billing_reason = subscription_cycle`) — Renewal: tops the balance up to the monthly Premium allowance (`TIER_DEFAULTS.PREMIUM`) and records a `premium_renewal` billing event. Yearly plans renew yearly, so they get this top-up once per year.

**Notes:**
- Idempotency is enforced via the `stripe_events` table (duplicate events are skipped).
- Returns `400` if signature verification fails.

---

### GET/POST/PATCH /api/gallery

Explicit, recorded, revocable publishing to Hall of Fame / Wall of Death / Community.
Approval state is **server-owned** (`lib/gallery-moderation-policy.ts`); nothing is ever published automatically.

**Auth:** Valid Appwrite JWT required for POST/PATCH. Guest (anonymous, no email) accounts get `403 GUEST_PUBLISH_BLOCKED`.

**GET** — Public feed returns only `status = approved` rows that are not revoked (`revoked_at` empty), filtered by
`type` (`HALL_OF_FAME | WALL_OF_DEATH | COMMUNITY`). `mine=1` (auth) returns the caller's own rows, optionally by `status`.

**POST Body** (only sent from an explicit "Allow" / "Share" click):
```json
{
  "title": "string",
  "juryQuote": "string",
  "galleryType": "HALL_OF_FAME" | "WALL_OF_DEATH" | "COMMUNITY",
  "imageBase64": "string (JPG/PNG/WEBP, magic bytes checked, <= 5MB)",
  "mimeType": "image/jpeg",
  "analysisKind": "SINGLE_JURY",
  "consent": { "granted": true, "version": "<GALLERY_CONSENT_VERSION>", "scope": "<same as galleryType>" }
}
```
Client fields such as `autoApproved`, `approved`, `status`, `moderationStatus` are **ignored** (logged as
`ignoredClientApprovalFields`).

Order of operations: auth → durable owner → payload + consent validation → image validation → moderation → storage write → row write.
No storage or DB write happens before consent is verified; a moderation rejection never reaches storage.

Moderation decision (same policy for Hall/Wall/Community and Confessions):
- `approved` only for a strict model verdict `{ "approved": true, "category": "SAFE" }` AND no prompt-injection markers
  in title/text.
- `pending` for missing key, network/non-2xx, unparsable output, any other shape, or injection suspicion.
- `rejected` (`422 COMMUNITY_MODERATION_REJECTED` / `GALLERY_MODERATION_REJECTED`) for `approved: false`.

**Success:** `{ item, submissionId, moderationPendingReview, code? }` where `code` is `COMMUNITY_PENDING_REVIEW` or
`GALLERY_PENDING_REVIEW` when pending.

**Errors:** `400 GALLERY_CONSENT_REQUIRED | GALLERY_CONSENT_SCOPE_MISMATCH | INVALID_GALLERY_PAYLOAD | INVALID_IMAGE_PAYLOAD`,
`409 GALLERY_CONSENT_VERSION_MISMATCH`, `413 GALLERY_IMAGE_TOO_LARGE`, `415 UNSUPPORTED_IMAGE_TYPE`, `500 GALLERY_WRITE_FAILED`.

**PATCH Body:** `{ "submissionId": "string", "action": "ARCHIVE" | "RESHARE", "consent"?: {...} }` (owner only)
- `ARCHIVE` revokes consent: allowed from `approved` or `pending`; sets `status=archived`, `revoked_at`,
  `archived_from_status`.
- `RESHARE` requires fresh `consent`; restores `approved` only if the row was `approved` before revocation, otherwise
  `pending` (legacy rows without `archived_from_status` go to `pending`).

#### Gallery row attributes added (additive, optional — created by `ensureCoreAppwriteResources`)

| Attribute | Type | Purpose |
|---|---|---|
| `consent_scope` | string(32) | Gallery type the user consented to |
| `consent_version` | string(64) | `GALLERY_CONSENT_VERSION` shown at consent time |
| `consented_at` | datetime | Server time of explicit consent |
| `revoked_at` | datetime | Set when the owner archives (revokes) |
| `archived_from_status` | string(32) | Status before revocation (`approved`/`pending`) |
| `moderated_by` | string(64) | Admin user id of the moderator decision |
| `moderated_at` | datetime | Time of moderator decision |

New status value: `rejected` (moderator rejection; row kept as evidence, image removed).

---

### GET/POST /api/gallery/moderation

Moderator review queue. **Auth:** verified-email admin (`isVerifiedAdmin`, `ADMIN_EMAILS`); others get `403` (logged).

- **GET** — oldest-first list of `pending` submissions.
- **POST** `{ "submissionId": "string", "action": "APPROVE" | "REJECT", "note"?: "string" }` — only `pending` rows
  (`409 INVALID_GALLERY_STATUS` otherwise). REJECT removes the stored image (idempotent cleanup). Every attempt is
  audited via `api.gallery.moderation.audit` logs (actor, action, from/to status).

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
