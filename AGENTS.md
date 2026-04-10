# AGENTS.md — Draw or Die

This file is the authoritative instruction and context source for all AI agents operating in this repo (Claude, Copilot, Jules, etc.). Read it in full before making any changes.

---

## 1. Project Overview

**Draw or Die** is an AI-powered architectural jury simulation application for architecture students. Users upload a drawing, render, sketch, or PDF; provide project context (concept, site, category); and receive a structured critique from an AI jury at a chosen harshness level. Results are placed in the **Hall of Fame** or **Wall of Death** gallery.

**Live URLs:** `https://drawordie.ackaraca.me` · `https://drawordie.app`  
**Appwrite Project:** `draw-or-die` (fra.cloud.appwrite.io)  
**Vercel Project:** defined in `.vercel/project.json`

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + Framer Motion |
| State | Zustand (`stores/drawOrDieStore.ts`) |
| Auth / DB / Storage | Appwrite |
| AI | Google Gemini (`gemini-3.1-pro-preview`) via OpenAI-compatible REST |
| Payments | Stripe (subscriptions + token purchases) |
| PDF Processing | `pdfjs-dist` (client-side text extraction + rasterization) |
| Testing | Jest (unit/integration) + Playwright (e2e smoke) |
| Deployment | Vercel |

---

## 3. Language Policy

This section defines the language rules for every layer of the project. All agents must follow these rules consistently.

| Layer | Language | Notes |
|---|---|---|
| LLM responses (AI critique output) | **English** | All AI-generated critique, feedback, and mentor messages must be in English |
| Code (source files, variable names, comments) | **English** | All TypeScript/TSX source code, comments, and inline docs must be in English |
| Documentation (AGENTS.md, docs/, README) | **English** | All markdown docs, API contracts, and architecture notes must be in English |
| Application UI (user-facing text) | **Turkish first, then English** | Default locale is `tr`. English (`en`) is the secondary supported locale. Additional languages may be added later via `lib/i18n.ts` |

### i18n Implementation

Language resolution is handled in `lib/i18n.ts`. Supported locales are `tr` and `en` (see `SupportedLanguage` type). The default fallback is always Turkish (`tr`). Use `pickLocalized(language, trText, enText)` for all dual-language string rendering. Do not hardcode locale-specific strings outside of `lib/i18n.ts` or translation data files.

When adding new user-facing strings:
- Always provide both `tr` and `en` variants.
- Never render a raw English string directly in a component without going through the localization layer.
- New supported languages must be added to `SupportedLanguage` in `lib/i18n.ts` first.

---

## 4. Folder Structure and Responsibilities

```
app/
  page.tsx                  — Root page: single orchestrator that hosts StepRouter
  layout.tsx                — Global layout, fonts, metadata
  globals.css               — Tailwind base + global styles
  api/
    ai-generate/            — AI jury analysis: auth, Rapido deduction, LLM proxy
    checkout/               — Stripe Checkout session creation
    webhook/stripe/         — Stripe event handling (payment, cancellation)
    gallery/                — Gallery submission and moderation
    profile/                — Profile read/update
    analysis-history/       — Analysis history CRUD + soft-delete recovery
    mentor/                 — AI Mentor chat sessions and messages
    verify-edu/             — Educational email verification
    referral/               — Referral link generation and application
    promos/                 — Promo code redemption
    billing/                — Stripe customer portal and billing history
    health/                 — Health check endpoint
    growth/                 — Growth and conversion event tracking
    client-log/             — Client-side error logging
    feedback/               — User feedback submission
    memory-snippets/        — AI context memory fragments

components/
  StepRouter.tsx            — Step-based UI state machine (StepType → component)
  HeroStep.tsx              — Landing page
  UploadStep.tsx            — File upload dropzone + project form
  AnalyzingSteps.tsx        — Loading animations during analysis
  ResultStep.tsx            — Standard single-persona jury result view
  PremiumResultStep.tsx     — Red Pen (Premium Rescue) result view
  MultiResultStep.tsx       — Multi-persona jury result view
  GalleryStep.tsx           — Hall of Fame / Wall of Death feed
  ChatDefense.tsx           — Multi-turn jury defense chat module
  AIMentorStep.tsx          — Badge, XP, and AI mentor panel
  AuthModal.tsx             — Login/signup modal
  Header.tsx                — Navigation + user stats bar
  PremiumUpgradeStep.tsx    — Premium purchase flow
  (others)                  — Profile, history, referral, promo, etc.

hooks/
  useAnalysis.ts            — AI analysis trigger, loading state, error handling
  useAuth.tsx               — Appwrite auth state (session, profile, Rapido balance)
  useGallery.ts             — Gallery data fetching and submission
  useDropHandler.ts         — Drag-and-drop and file validation
  useGuestRapido.ts         — Guest user temporary Rapido tracking

lib/
  ai.ts                     — LLM request builder, prompt construction, JSON parsing
  critique.ts               — Critique prompt templates
  pricing.ts                — All Rapido costs and Stripe price IDs (single source of truth)
  appwrite.ts               — Appwrite client/server SDK initialization
  rate-limit.ts             — IP + user-based rate limiting
  growth-tracking.ts        — Analytics event definitions
  referral.ts               — Referral code generation and validation
  promo-codes.ts            — Promo code validation logic
  mentor-limits.ts          — AI Mentor usage limits
  step-routing.ts           — StepType transition rules
  i18n.ts                   — Language resolution and localization helpers
  utils.ts                  — General utility functions
  logger.ts                 — Server-side structured logging

stores/
  drawOrDieStore.ts         — Central Zustand store (all UI + domain state)

types/
  index.ts                  — All shared TypeScript type definitions

docs/
  ARCHITECTURE.md           — Detailed system architecture
  API.md                    — API contracts
  ENVIRONMENT.md            — Environment variable reference
```

---

## 5. Application Flow (Step State Machine)

`StepRouter.tsx` renders the correct component based on the `step` value in `drawOrDieStore`:

```
hero → upload → analyzing / premium-analyzing / multi-analyzing
     → result / premium / multi-result
     → gallery
     → ai-mentor / profile / history / account-details
     → premium-upgrade / rapido-shop
```

`app/page.tsx` holds no content of its own — it only wraps providers and renders `StepRouter`.

---

## 6. Rapido Economy

Rapido is the application's virtual currency. All costs are defined exclusively in **`lib/pricing.ts`** — no hardcoded values anywhere else in the codebase.

### Operation Costs (current)

| Operation | Cost |
|---|---|
| `SINGLE_JURY` | 4 |
| `REVISION_SAME` | 1 |
| `REVISION_DIFFERENT` | 2 |
| `MULTI_JURY` | 10 |
| `MULTI_JURY_REVISION` | 2 |
| `AUTO_CONCEPT` | 5 |
| `MATERIAL_BOARD` | 3 |
| `DEFENSE` | 4 |
| `AI_MENTOR` | 3 / 1,000 tokens |
| `PREMIUM_RESCUE` | 6 |

### Starting Balances

| Tier | Rapido |
|---|---|
| Guest | 4 |
| Anonymous | 4 |
| Registered | 15 (one-time) |
| Premium | 200 (monthly) |

### Critical Rule

**The client never deducts its own Rapido balance.** All deductions happen server-side inside `/api/ai-generate`, after JWT validation.

---

## 7. Premium Features

The following operations are restricted to Premium subscribers (`lib/pricing.ts → PREMIUM_FEATURES`):

- `MULTI_JURY` / `MULTI_JURY_REVISION`
- `MATERIAL_BOARD`
- `DEFENSE`
- `AI_MENTOR`

---

## 8. AI Prompt Engineering Rules

- **JSON mode is mandatory.** Every LLM request must include `responseMimeType: "application/json"` and a strict JSON schema. Never send a request without a schema.
- **Harshness level (1–5)** must be injected into the prompt. Level `5/5` forces a brutal, unforgiving critique tone.
- **Persona ID** (`JuryPersonaId`): `constructive | structural | conceptual | grumpy | contextualist | sustainability` — must be specified in the prompt before use.
- **PDF context:** `pdfText` extracted by `pdfjs-dist` must be appended to the prompt so the vision model can read labels and annotations it would otherwise miss.
- **`PREMIUM_RESCUE`** mode requires the LLM to return bounding-box coordinates (`x, y, width, height`) as relative values; the JSON schema must be designed accordingly.
- **`DEFENSE`** mode is multi-turn (tracked via `turnCount`, max 3 turns). The full chat history must be included in every request.
- **All LLM output must be in English** regardless of the user's locale (see Language Policy above).

---

## 9. API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/ai-generate` | POST | AI jury analysis + Rapido deduction |
| `/api/checkout` | POST | Stripe Checkout session |
| `/api/webhook/stripe` | POST | Stripe event processing |
| `/api/gallery` | GET/POST | Gallery listing and submission |
| `/api/profile` | GET/PATCH | User profile |
| `/api/analysis-history` | GET/DELETE | Analysis history |
| `/api/analysis-history/recover` | POST | Recover soft-deleted analysis |
| `/api/mentor/chats` | GET/POST | AI Mentor chat sessions |
| `/api/mentor/chats/[chatId]/messages` | GET/POST | Mentor messages |
| `/api/verify-edu` | POST | Educational email verification |
| `/api/referral/link` | GET | Referral link generation |
| `/api/referral/apply` | POST | Apply referral code |
| `/api/promos/redeem` | POST | Promo code redemption |
| `/api/checkout/validate-promo` | POST | Pre-payment promo validation |
| `/api/billing/portal` | POST | Stripe customer portal |
| `/api/billing/history` | GET | Billing history |
| `/api/health` | GET | Health check |
| `/api/growth/conversion` | POST | Conversion event logging |
| `/api/client-log` | POST | Client-side error logging |
| `/api/feedback` | POST | User feedback |
| `/api/memory-snippets` | GET | AI context memory fragments |

---

## 10. Security Boundaries

- **No secrets on the client:** `STRIPE_SECRET_KEY`, `APPWRITE_API_KEY`, and `AI_API_KEY` must never enter the client bundle.
- **Profile mutations:** `rapido_pens`, `is_premium`, and `progression_score` are only ever updated from server-side routes.
- **JWT validation:** `/api/ai-generate` validates `Authorization: Bearer <appwrite_jwt>` on every request before proceeding.
- **Rate limiting:** IP + user-based limiting is active via `lib/rate-limit.ts`.
- **Stripe webhook:** No event is processed unless the `stripe-signature` header is verified against `STRIPE_WEBHOOK_SECRET`.
- **Idempotency:** The `stripe_events` table ensures the same Stripe event is never processed twice.
- **File validation:** Uploaded files are checked for MIME type, size, and magic bytes (file signature).
- **CORS:** No wildcard (`*`) in `ALLOWED_ORIGINS`.

---

## 11. Stripe Pricing and Tier System

Tier is resolved automatically from the user's email address (`lib/pricing.ts → resolveStripeTierForUser`):

| Tier | Criteria | Monthly | Yearly |
|---|---|---|---|
| `AKDENIZ_STUDENT` | `@akdeniz.edu.tr` | 149 TRY | 1,249 TRY |
| `TR_STUDENT` | `.edu.tr` domain | 299 TRY | 2,499 TRY |
| `GLOBAL` | All others | $15 | $129 |

Rapido packs use the same per-unit price across all tiers (`RAPIDO_UNIT`). Minimum purchase quantity: 5 units.

---

## 12. Data Model (Appwrite)

### `profiles`
One record per user; matches `auth.users.id`.

`rapido_pens` · `is_premium` · `progression_score` · `wall_of_death_count` · `earned_badges` (jsonb) · `stripe_customer_id` · `stripe_subscription_id` · `edu_verified` · `edu_email`

### `gallery_submissions`
`user_id` · `image_path` · `public_url` · `critique_data` (jsonb) · `gallery_type` (`HALL_OF_FAME | WALL_OF_DEATH`) · `status` (`pending | approved | rejected`)

### `stripe_events`
Stripe idempotency ledger. PK: Stripe Event ID.

---

## 13. Development Rules

### Code Quality
- Modern React only: functional components + hooks — no class components.
- TypeScript `strict` mode is enforced; avoid `any`.
- All import paths use the `@/` alias (`@/components/...`, `@/lib/...`, etc.).
- Rapido costs and Stripe price IDs must only be defined in `lib/pricing.ts` — never hardcoded elsewhere.
- All source code, comments, and variable names must be in English.

### Pre-Delivery Checks
Run these commands after every change before concluding a task:

```bash
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript type check
npm run test          # Jest unit tests
```

For critical changes, also run:
```bash
npm run test:e2e:smoke
```

### Change Management
- Prefer minimal, reversible changes.
- Preserve existing API/data/UI contracts unless a requirement explicitly changes them.
- Always add validation and error handling to mutations.
- Seek approval before risky or destructive operations.

---

## 14. Planned Features (Gamification Update)

- **Weekly Charettes:** Weekly design prompts with Rapido rewards
- **Leaderboard:** Global ranking by university / studio
- **Badges:** Jury survival, defense success, etc.
- **Multi-Persona Jury:** 3 personas critiquing simultaneously
- **Social Tools:** "Roast My Project" export, peer reviews, anonymous confessions

---

## 15. References

- Detailed architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- API contracts: [`docs/API.md`](docs/API.md)
- Environment variables: [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md)
