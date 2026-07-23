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

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# App
NEXT_PUBLIC_APP_URL=https://drawordie.ackaraca.me
NEXT_PUBLIC_GOOGLE_TAG_ID=GT-XXXXXXXX
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GA_SECONDARY_MEASUREMENT_ID=G-YYYYYYYYYY
NEXT_PUBLIC_GA_DESTINATION_IDS=GT-XXXXXXXX,G-XXXXXXXXXX,G-YYYYYYYYYY
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
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist | e.g. `https://drawordie.ackaraca.me,https://drawordie.app` |
| `NEXT_PUBLIC_PREMIUM_RESCUE_IMAGE_EDITING_ENABLED` | Enables the future client-side image-editing rescue path. Keep `false` until manually tested. | `false` |

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
