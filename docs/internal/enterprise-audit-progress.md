# Enterprise Audit — Implementation Progress Snapshot

Snapshot date: 2026-10-15 · Code basis: `main` (`d0799c0`) plus `dd0c6c1` / `57223ec` (P0 holds, DOD-4; not yet on `main`).

The package plans in `docs/enterprise-audit/branches/*/README.md` still say `Status: Planned`. That field is governed by
`VALIDATION-CONTRACT.json` (a lifecycle change needs DRI, approver, gate evidence and a `VERIFICATION.md`). None of the
packages below meets its acceptance criteria, so the field stays `Planned`. This file records the partial code progress
so agents do not re-implement existing work or treat a plan as untouched. Verdicts come from reading the code; update
this file when a package moves.

Most risky paths are currently contained by fail-closed P0 holds (`lib/p0-holds.ts`, 503 `CAPABILITY_ON_HOLD`).
Containment is not a fix: the gaps below become live again once a hold is released.

| Package | Verdict | Already in code (evidence) | Main gaps |
|---|---|---|---|
| 03 explicit gallery consent | Partial | No auto-publish on analysis completion; publishing only via `submitGalleryConsent` (`hooks/useAnalysis.ts`, test `hooks/useAnalysis.test.tsx`). Owner archive/reshare PATCH. Gallery hold on POST/public GET. | `autoApproved` still in client contract and honoured server-side for HALL_OF_FAME / WALL_OF_DEATH (`app/api/gallery/route.ts`). Guests can POST. No consent scope/version/time record, no historical inventory, no route-level ownership test. |
| 04 edu OTP secrecy | Partial (early) | `devOtp` removed; OTP stripped from client profile; timing-safe compare; per-user rate limit; edu hold on POST/PUT. | OTP stored in plaintext on the profile (no HMAC / purpose / attempt binding). Non-atomic consume. Profile DTO is a denylist and still exposes Stripe IDs and `edu_verification_*`. No email/IP rate-limit dimensions. No expired/replay/concurrency tests. |
| 06 verified-identity rewards | Partial | Referral reward requires verified email + new account; self/old/anonymous referral rejected; one-time `claimOnce`; atomic promo slot reservation; rewards hold on referral, promo and early-registration bonus. Tests: `lib/referral.test.ts`, `lib/promo-redeem.test.ts`. | Early-registration bonus and promos check email presence, not verification. No shared eligibility policy, no velocity/cycle controls. Possible double pay when referrer credit fails after the referee is credited (`lib/referral.ts`). No historical audit. |
| 15 atomic Rapido ledger | Not started | Atomic increment/decrement on `rapido_pens` (`lib/rapido-balance.ts`); `paid_ai_wallet` hold. | No journal, reserve/settle/void, projection, backfill or adjustment audit. Fractional-cost path is read-then-write. `billing_events` best-effort only. |
| 16 Stripe webhook idempotency | Partial | Signature verification; duplicate skip via unique `event_id`; row released on handler failure so Stripe retries; hold leaves events unrecorded (503). Tests: `app/api/webhook/stripe/route.test.ts`. | No received → processing → succeeded/failed state, lease or attempts. Event marked before effects run. Failed rows deleted instead of kept for replay. No audit for unknown types, no livemode/account check, no metrics. |
| 17 Stripe entitlement reconciliation | Partial (early) | Success URL grants nothing (webhook-only grants); renewal top-up with first-invoice skip; cancellation removes premium; checkout hold. | `handleCheckoutComplete` trusts `metadata.rapido_quantity` (no price/amount/currency/livemode/`payment_status` checks). No refund/dispute handling, no out-of-order convergence, no customer reuse / duplicate-subscription guard, no reconciliation job. |
| 19 privacy data lifecycle | Not started | Cookie-banner close records `rejected`; GA consent mode defaults to denied. | gtag script always loads; close is not distinct from reject. No account export/delete orchestration, tombstones, DSR workflow, data inventory or retention rules. |
| 21 AI request lifecycle | Partial | Total deadline with per-attempt timeout, retry on 408/425/429/5xx, `Retry-After` within budget (`lib/ai-completion.ts`); Rapido charged only after success; preview/experimental model block (`lib/ai-model-policy.ts`). Tests: `lib/ai-completion.test.ts`, `lib/ai-model-policy.test.ts`. | Client disconnect (`request.signal`) not propagated. No operation/idempotency ID, reservation or cost cap. No telemetry reconciled to a ledger. No route-level `ai-generate` tests. |
| 25 AI moderation boundaries | Partial | Community moderation outage → pending, parse uncertainty → rejected; confessions fail-pending; public feed filters `status='approved'`; untrusted content fenced in prompt. | HALL_OF_FAME / WALL_OF_DEATH skip moderation via client `autoApproved`. No shared state machine (consented/revoked), no PII/spam pre-checks, no moderator/appeal/audit flow, no injection corpus, no moderation tests. |
| 28 core-flow accessibility | Partial | `DialogFrame` focus trap / Escape / focus restore (ConfirmDialog, AuthModal, UploadStep, with tests); reduced motion via `MotionPreferences` + CSS media query. | No axe tooling or manual a11y script. Errors mostly toast-only; few `aria-live` regions. Background `inert` and touch alternatives unverified. |
| 31A search identity | Partial | `metadataBase` + per-route canonical; single robots/sitemap; auth pages noindex. | No legacy-domain redirects; `docs/ENVIRONMENT.md` still shows the legacy app URL example. No preview/dev noindex. Sitemap lists gallery routes while the gallery is held. Analytics IDs not split per environment. |

Relevant commits: `467aa98` (AI backend), `5d266e6` (payment/moderation API fixes), `3ac1d7f` (i18n/a11y/SEO),
`649735f` (consent-based sharing), `d0799c0` (verified-email gating, referral/promo races, renewals), `dd0c6c1` and
`57223ec` (P0 holds and their route tests).
