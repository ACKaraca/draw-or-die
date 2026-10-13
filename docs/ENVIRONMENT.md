# Draw or Die — Environment Variables

## `.env.local` (Next.js)

```env
# Appwrite (client-side)
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=draw-or-die

# Appwrite (server-side — never expose to the client)
APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=draw-or-die
APPWRITE_API_KEY=your-appwrite-server-api-key
# Optional (development): local-only server key override to avoid OS-level env collisions
APPWRITE_API_KEY_LOCAL=your-local-appwrite-server-api-key
# Optional: reset the early-registration bonus cohort window.
APPWRITE_EARLY_REGISTRATION_BONUS_START_AT_V2=2026-04-12T00:00:00.000Z

# Optional: dedicated email provider for edu verification emails.
# If empty, the default configured Appwrite email provider is used.
APPWRITE_EDU_EMAIL_PROVIDER_ID=your-email-provider-id
# Server-only HMAC key for edu verification codes (>= 32 random bytes, e.g. `openssl rand -hex 32`).
# If unset, a key derived from APPWRITE_API_KEY is used; rotating either invalidates pending codes only.
EDU_OTP_HMAC_SECRET=your-random-hex-secret

# Rewards (lib/reward-policy.ts)
# Kill switch: `true` stops every reward grant (registration, referral, peer review). Balances are untouched.
REWARDS_PAUSED=false
# ISO timestamp of the deploy that moved the early-registration bonus behind the reward policy.
# Profiles created before it were already funded at creation and are never paid again.
# Unset = registration bonus paused (fail closed).
REGISTRATION_BONUS_ACTIVATION_AT=2026-10-13T00:00:00.000Z

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
# Optional webhook guards (see "Stripe Webhook Variables" below)
STRIPE_EXPECTED_LIVEMODE=true
STRIPE_ACCOUNT_ID=
STRIPE_WEBHOOK_PAUSED=false

# App
NEXT_PUBLIC_APP_URL=https://drawordie.app
# Optional: set to `development`/`staging`/`preview` on non-production deployments (e.g. the Appwrite dev site).
SITE_ENV=production
NEXT_PUBLIC_GOOGLE_TAG_ID=GT-XXXXXXXX
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GA_SECONDARY_MEASUREMENT_ID=G-YYYYYYYYYY
NEXT_PUBLIC_GA_DESTINATION_IDS=GT-XXXXXXXX,G-XXXXXXXXXX,G-YYYYYYYYYY
# Optional: separate GA property for dev/preview. Production IDs are always stripped from it.
NEXT_PUBLIC_GA_NON_PRODUCTION_IDS=G-DEVXXXXXXX
```

## Search Identity (canonical domain, indexing, analytics isolation)

Source of truth: `lib/site-identity.ts`. A request is **production** only when all of these hold:

1. `NODE_ENV=production`,
2. `VERCEL_ENV` is unset or `production` (a Vercel preview build is never production),
3. `SITE_ENV` is unset or `production` (use it to mark non-Vercel non-production deployments),
4. the request host (`x-forwarded-host`, else `host`) is exactly `drawordie.app`.

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `metadataBase` origin outside production. Ignored in production (always `https://drawordie.app`); legacy domains are rejected. | `https://drawordie.app` |
| `SITE_ENV` | Deployment label. Any value other than `production` forces noindex and disables production analytics. | unset |
| `VERCEL_ENV` | Injected by Vercel; `preview`/`development` forces noindex and disables production analytics. | injected |
| `NEXT_PUBLIC_GA_NON_PRODUCTION_IDS` | Comma-separated GA/Google tag IDs loaded **only** outside production. Production IDs are filtered out. | unset (no analytics) |

Behaviour outside production: `robots.txt` is `Disallow: /` with no sitemap, `sitemap.xml` is empty, every response
carries `X-Robots-Tag: noindex, nofollow`, every page renders `<meta name="robots" content="noindex, nofollow">`, and the
production `NEXT_PUBLIC_GOOGLE_TAG_ID` / `NEXT_PUBLIC_GA_*` IDs are never injected.

Legacy hosts `drawordie.ackaraca.me` and `www.drawordie.app` redirect permanently (308) in one hop to the same path on
`https://drawordie.app` (`next.config.ts` → `redirects`). They only take effect if those domains are attached to the
production deployment.

Verify a deployment (read-only HTTP GETs):

```bash
npm run check:search-identity -- https://dev.drawordie.app
npm run check:search-identity -- https://drawordie.app --check-legacy
npm run check:search-identity -- https://<preview>.vercel.app --expect=non-production
```

## AI Gateway Variables (Next.js API Route / Server-side)

These are used by `/api/ai-generate` to call the LLM.

| Variable | Description | Default |
|---|---|---|
| `AI_API_KEY` | API key for the AI provider | — |
| `AI_BASE_URL` | OpenAI-compatible endpoint base URL | `https://ai-gateway.vercel.sh/v1` |
| `AI_MODEL` | Model identifier string | `google/gemini-3.1-flash-lite-preview` |
| `AI_MODEL_ANALYSIS` | Shared model for `MATERIAL_BOARD`, `SINGLE_JURY`, `MULTI_JURY`, and `REVISION_SAME` | falls back to `AI_MODEL` |
| `AI_MODEL_MENTOR` | Model for `AI_MENTOR`, including file-attached mentor requests | falls back to `AI_MODEL` |
| `AI_MODEL_LOW_COST` | Lower-cost model for `DEFENSE`, `AUTO_CONCEPT`, and `AUTO_FILL_FORM` | falls back to `AI_MODEL` |
| `AI_MODEL_PREMIUM_RESCUE` | Optional stronger model for `PREMIUM_RESCUE` coordinate rescue analysis | falls back to `AI_MODEL_ANALYSIS` |
| `AI_MODEL_FALLBACKS` | Comma-separated fallback models when primary model is temporarily unavailable | `google/gemini-2.5-flash-lite` |
| `AI_STRUCTURED_OUTPUTS` | Strict JSON-schema responses for jury, mentor, defense, auto-fill and rescue calls. Set to `off` to roll back to prompt-only JSON if a provider rejects `json_schema`. | on |
| `AI_REASONING_EFFORT` | Optional `reasoning_effort` sent to the provider for every call (`none`, `minimal`, `low`, `medium`, `high`). Unset = provider default. Check token usage in the `api.ai-generate.usage` logs before/after changing it. | unset |
| `AI_REASONING_EFFORT_FAST` | Same as above but only for latency-sensitive calls (`DEFENSE`, `AUTO_FILL_FORM`, `AUTO_CONCEPT`, `AI_MENTOR`, `SKILL_ROADMAP`). `low` usually cuts cost and latency for these. | falls back to `AI_REASONING_EFFORT` |

Every successful provider call logs one `[server-info]` line with scope `api.ai-generate.usage` (operation, model, attempts, duration, prompt/completion/reasoning tokens). Use it to measure cost per operation before tuning models or reasoning effort.

Provider calls have a 100 s budget. Transient failures (network errors, 408/425/429/5xx) are retried once, on the first `AI_MODEL_FALLBACKS` entry when the primary is a Gemini 3.1 model. On the Vercel AI Gateway the same fallback is also sent as the gateway's `models` list so most failovers happen inside a single request.
A retry only starts if it still fits the budget after its back-off (`Retry-After` capped at 3 s); timeouts, client cancellation, other 4xx, safety refusals (`content_filter`) and output truncated at the token cap are never retried.

| Variable | Description | Default |
|---|---|---|
| `AI_MAX_OUTPUT_TOKENS` | Per-attempt `max_tokens` sent to the provider (ceiling 65536). With the 2-attempt cap this bounds the output one operation can buy. | `16384` |
| `RAPIDO_LEDGER_MODE` | `off` = legacy charge-after-success only. Anything else = reserve → settle/void through the append-only journal (`lib/rapido-ledger.ts`), automatically falling back to legacy while the journal table is missing. | ledger (auto) |
| `APPWRITE_TABLE_RAPIDO_LEDGER_ID` | Append-only Rapido journal table, provisioned by `scripts/rapido-ledger-backfill.mjs --apply` (not by runtime bootstrap). | `rapido_ledger_entries` |
| `APPWRITE_TABLE_DELETION_REQUESTS_ID` | Pseudonymous account-deletion request/tombstone table (`lib/privacy/deletion-store.ts`), created lazily on first use. | `deletion_requests` |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist | e.g. `https://drawordie.app,https://dev.drawordie.app` |
| `NEXT_PUBLIC_PREMIUM_RESCUE_IMAGE_EDITING_ENABLED` | Enables the future client-side image-editing rescue path. Keep `false` until manually tested. | `false` |

## Stripe Webhook Variables (server-side)

Used by `/api/webhook/stripe` (`lib/stripe-webhook-processor.ts`). Every event is signature-verified with
`STRIPE_WEBHOOK_SECRET`, claimed in `stripe_events` (status/lease/attempts) and processed exactly once in effect.

| Variable | Description | Default |
|---|---|---|
| `STRIPE_EXPECTED_LIVEMODE` | `true` / `false`. Events whose `livemode` differs are recorded as `rejected` and grant nothing. | derived from the `STRIPE_SECRET_KEY` prefix (`sk_live_`/`rk_live_` → `true`, `sk_test_`/`rk_test_` → `false`) |
| `STRIPE_ACCOUNT_ID` | Only needed if Connect events are ever sent to this endpoint. Events carrying an `account` other than this id are rejected. Direct (non-Connect) events have no `account` and are accepted. | unset (all Connect events rejected) |
| `STRIPE_WEBHOOK_PAUSED` | Kill switch. `true` answers every delivery with 503 without touching state, so Stripe keeps retrying (up to 3 days). Unset/`false` resumes processing. | `false` |

Subscribe the endpoint to: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`, `customer.subscription.created|updated|deleted|paused|resumed`,
`invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.
Other event types are acknowledged and recorded as `ignored`.

Failed events stay in `stripe_events` with `status=failed`, `attempts` and `last_error`. Replay them with
`node scripts/replay-stripe-events.mjs` (dry-run by default; needs `DOD_ADMIN_JWT` of a verified admin and `--execute`
plus explicit `--event` ids to change anything). Follow the branch-16 replay runbook before executing.

## Release Verification Variables

These values are controlled by CI/CD and are not application secrets.

| Variable | Description | Required in |
|---|---|---|
| `RELEASE_SHA` | Runtime fallback for a 40-character commit SHA. Manual Appwrite archives also embed this value at build time. | Local smoke and release archive stamping |
| `RELEASE_DEPLOYMENT_ID` | Runtime fallback when the hosting provider does not inject a deployment ID. | Local smoke only |
| `EXPECTED_RELEASE_SHA` | Exact commit SHA that health verification must observe. | Smoke and post-deploy verification |
| `EXPECTED_DEPLOYMENT_ID` | Exact deployment ID that health verification must observe. | Smoke and post-deploy verification |
| `HEALTHCHECK_TARGET` | Fixed health-check target: `staging` or `production`. | Post-deploy verification |

Appwrite's injected `APPWRITE_VCS_COMMIT_HASH` and `APPWRITE_SITE_DEPLOYMENT` values take precedence when present.

## Security Rules

1. **Never** store API keys in source code, commits, chat messages, or screen shares.
2. If any Stripe or third-party API key is exposed, **rotate it immediately** from the relevant dashboard.
3. `APPWRITE_API_KEY` must only be used server-side (API routes, webhooks). Never include it in client-side code.
4. All `NEXT_PUBLIC_*` variables are exposed to the client bundle — never put secrets in them.
5. Stripe secret keys (`sk_live_`) must only be used server-side.
6. Never use a wildcard (`*`) in `ALLOWED_ORIGINS`.

## Common Issues

### 503 on Checkout

This error typically means `STRIPE_SECRET_KEY` is not set in your Vercel environment.  
Fix: Vercel Dashboard → Settings → Environment Variables → add `STRIPE_SECRET_KEY`.

### AI requests returning 503

`AI_API_KEY` is not set. Add it as a server-side environment variable (not `NEXT_PUBLIC_`).

### Auth failures after deploy

Verify `APPWRITE_ENDPOINT` and `APPWRITE_PROJECT_ID` match the project in Appwrite Cloud. Also confirm `APPWRITE_API_KEY` has the correct scopes.

### Google OAuth redirects to localhost or fails on mobile

If `NEXT_PUBLIC_APP_URL` is set to `https://localhost:3000` in a deployed build, OAuth and email verification flows can bounce to localhost and fail.
Use your real deployed domain in environment settings, or rely on runtime origin based redirects.
