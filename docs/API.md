# Draw or Die — API

## Next.js API Routes

### POST /api/checkout

Creates a Stripe Checkout session.

**Auth:** Valid Appwrite session required (server-side user check)

**Body:**
```json
{
  "mode": "premium_monthly" | "premium_yearly" | "rapido_pack",
  "quantity": 5  // only for rapido_pack
}
```

**Response (200):**
```json
{ "url": "https://checkout.stripe.com/..." }
```

**Errors:**
- `401` — Authentication required
- `400` — Invalid checkout mode
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
- `invoice.payment_failed` — Logged for observability

**Notes:**
- Idempotency is enforced via the `stripe_events` table (duplicate events are skipped).
- Returns `400` if signature verification fails.

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

Applies a referral code, granting bonus Rapido to both parties.

**Auth:** Valid Appwrite JWT required.

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

Basic health check. Returns `200 OK` when the service is operational. Used by uptime monitors.

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
  "operation": "SINGLE_JURY" | "PREMIUM_RESCUE" | "REVISION_SAME" | "REVISION_DIFFERENT" | "MULTI_JURY" | "MULTI_JURY_REVISION" | "DEFENSE" | "AI_MENTOR" | "AUTO_CONCEPT" | "MATERIAL_BOARD",
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
    "analysisLength": "SHORT" | "MEDIUM" | "LONG" | "WORD_TARGET",
    "singlePersonaId": "constructive" | "structural" | "conceptual" | "grumpy" | "contextualist" | "sustainability",
    "multiPersonaIds": ["string"]
  }
}
```

**Execution flow:**
1. Validates Appwrite JWT and resolves user ID.
2. Checks operation cost from `lib/pricing.ts`. Returns `402` if balance is insufficient.
3. Checks `PREMIUM_FEATURES` list. Returns `403` if operation requires Premium and user is not subscribed.
4. Constructs prompt based on `operation`, `params.harshness`, and persona IDs.
5. Calls the LLM with strict `application/json` response mode.
6. Updates `game_state` (progression score, badges) if applicable.
7. Deducts Rapido and returns the result.

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
- `429` — Rate limit exceeded
- `503` — `AI_API_KEY` not configured
- `500` — Unexpected processing error
