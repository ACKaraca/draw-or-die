# Peer Review API Contracts

## `/references`

### GET
- **File:** `app/api/references/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ references: rows.rows.map(toCardPayload`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ reference: toCardPayload(row`
  - Status 200: `{ error: pickLocalized(lang`
- **Failure Modes:**
  - Status 401: `{ error: 'Unauthenticated', code: 'UNAUTHENTICATED' }`
  - Status 403: `{ error: 'Forbidden', code: 'FORBIDDEN' }`
  - Status 429: `{ error: 'Rate limited', code: 'RATE_LIMITED' }`

### POST
- **File:** `app/api/references/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ references: rows.rows.map(toCardPayload`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ reference: toCardPayload(row`
  - Status 200: `{ error: pickLocalized(lang`
- **Failure Modes:**
  - Status 401: `{ error: 'Unauthenticated', code: 'UNAUTHENTICATED' }`
  - Status 403: `{ error: 'Forbidden', code: 'FORBIDDEN' }`
  - Status 429: `{ error: 'Rate limited', code: 'RATE_LIMITED' }`

## `/references/[id]`

### GET
- **File:** `app/api/references/[id]/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ reference: toDetailPayload(row`
  - Status 200: `{ error: pickLocalized(lang`
- **Failure Modes:**
  - Standard 500s only or no specific failures

## `/feedback`

### POST
- **File:** `app/api/feedback/route.ts`
- **Auth:** Requires authentication (`getAuthenticatedUserFromRequest`)
- **Rate Limits:** Yes: `maxRequests: Math.max(8, RATE_LIMITS.GENERAL.maxRequests / 6), windowMs: RATE_LIMITS.GENERAL.windowMs,`
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ ok: false`
  - Status 200: `{ ok: false`
  - Status 200: `{ ok: true }`
  - Status 200: `{ ok: false`
- **Failure Modes:**
  - Standard 500s only or no specific failures

## `/peer-review`

### GET
- **File:** `app/api/peer-review/route.ts`
- **Auth:** Requires authentication (`getAuthenticatedUserFromRequest`)
- **Rate Limits:** None
- **Request Schema:** URL Query Parameters: 'page', 'limit'
- **Response Schema:**
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ openings: [], total: openingsResult.total ?? 0 }`
  - Status 200: `{ openings, total: openingsResult.total ?? 0, }`
  - Status 200: `{ error: pickLocalized(lang`
- **Failure Modes:**
  - Standard 500s only or no specific failures

## `/peer-review/open`

### POST
- **File:** `app/api/peer-review/open/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized( lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized( lang`
  - Status 200: `{ opening: { id: openingRow.$id, submissionId: openingRow.submission_id, status: openingRow.status, reviewCount: openingRow.review_count, maxReview...`
  - Status 200: `{ error: pickLocalized( lang`
  - Status 200: `{ opening: { id: opening.$id, submissionId: opening.submission_id, status: opening.status, reviewCount: opening.review_count, maxReviews: opening.m...`
  - Status 200: `{ error: pickLocalized(lang`
- **Failure Modes:**
  - Standard 500s only or no specific failures

## `/peer-review/[openingId]`

### GET
- **File:** `app/api/peer-review/[openingId]/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ opening: { id: openingRow.$id, submissionId: openingRow.submission_id, ownerUserId: openingRow.owner_user_id, status: openingRow.status, reviewCo...`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized( lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized( lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized( lang`
  - Status 200: `{ error: pickLocalized( lang`
  - Status 200: `{ review: { id: newReview.$id, reviewerDisplay: newReview.reviewer_display, body: newReview.body, rating: newReview.rating ?? null, createdAt: newR...`
  - Status 200: `{ error: pickLocalized(lang`
- **Failure Modes:**
  - Standard 500s only or no specific failures

### POST
- **File:** `app/api/peer-review/[openingId]/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ opening: { id: openingRow.$id, submissionId: openingRow.submission_id, ownerUserId: openingRow.owner_user_id, status: openingRow.status, reviewCo...`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized( lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized( lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized( lang`
  - Status 200: `{ error: pickLocalized( lang`
  - Status 200: `{ review: { id: newReview.$id, reviewerDisplay: newReview.reviewer_display, body: newReview.body, rating: newReview.rating ?? null, createdAt: newR...`
  - Status 200: `{ error: pickLocalized(lang`
- **Failure Modes:**
  - Standard 500s only or no specific failures
