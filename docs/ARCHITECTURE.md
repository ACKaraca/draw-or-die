# Draw or Die — Complete Architecture Documentation

## 1. System Overview

**Draw or Die** is a gamified, AI-powered architectural jury application built for students to upload their designs (sketches, renders, CAD plots, PDFs) and receive simulated critique. The application is built entirely on the modern full-stack ecosystem.

**Core Tech Stack**:
- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS, Framer Motion. State management is handled centrally via Zustand.
- **Backend / Auth / Database**: Appwrite (Auth, Databases, Storage).
- **Serverless / AI Interop**: Next.js API routes, especially `/api/ai-generate`, acting as a proxy to OpenAI-compatible endpoints (defaulting to Google Gemini models via REST API).
- **Payment / Economy**: Stripe for subscriptions (Premium) and consumable tokens ("Rapido" pens).

**High-Level User Journey**:
1. **Landing & Auth**: User visits the hero page, optionally explores the public gallery, and logs in/signs up via Appwrite Auth.
2. **Upload & Form**: User uploads an artifact (`UploadStep`). File undergoes validation and client-side processing (e.g., PDF text extraction via `pdfjs-dist`). User fills out project context (concept, site, category).
3. **AI Jury Execution**: User selects a feedback type (Single Jury, Multi Jury, Rescue, etc.). The frontend invokes `/api/ai-generate`, deducting Rapido pens.
4. **Result & Defense**: AI returns a JSON-structured critique. The UI navigates to a result step where the user can review feedback, earn progression points, and optionally engage in a multi-turn chat defense against the jury.
5. **Gallery Moderation**: Users can opt-in to publish their results to the "Hall of Fame" or "Wall of Death", requiring manual moderation.

---

## 2. App Router Map & Component Architecture

The Next.js structure embraces the App Router paradigm, but heavily centralizes state in a unified Zustand store, implementing a pseudo Single-Page Application state machine for the core flow.

### Routing Tree
- `/` (`app/page.tsx`): The single orchestrator for the primary application flow. It sets up providers, hydrates auth state, and dynamically renders the appropriate UI step.
- `/api/ai-generate`: Core AI critique proxy and Rapido deduction entry point.
- `/api/checkout`: Next.js Route Handler for generating Stripe Checkout sessions.
- `/api/webhook/stripe`: Next.js Route Handler for receiving async Stripe events (payments, subscriptions).

### State Machine (`StepRouter.tsx`)
The `StepRouter` component sits inside `app/page.tsx` and manages the view based on the current `StepType` defined in `types/index.ts`:

- `hero`: Landing page (`HeroStep.tsx`).
- `upload`: File dropzone and project form (`UploadStep.tsx`).
- `analyzing` / `premium-analyzing` / `multi-analyzing`: Loading states with animations (`AnalyzingSteps.tsx`).
- `result`: Standard single-persona text critique (`ResultStep.tsx`).
- `premium`: Red-pen visual flaw detection with practical solutions (`PremiumResultStep.tsx`).
- `multi-result`: Feedback from three distinct jury personas simultaneously (`MultiResultStep.tsx`).
- `gallery`: Public Hall of Fame / Wall of Death feeds (`GalleryStep.tsx`).
- `ai-mentor`: Gamification dashboard showing badges, progression, and mentor chat (`AIMentorStep.tsx`).
- `profile` / `history` / `account-details`: User management views.
- `premium-upgrade` / `rapido-shop`: Monetization flows (`PremiumUpgradeStep.tsx`).

---

## 3. API Contracts

### A. Stripe Checkout Session (`POST /api/checkout`)
Initiates a payment flow.
- **Auth**: Must have a valid Supabase Server Session.
- **Payload**: `{ "mode": "premium_monthly" | "premium_yearly" | "rapido_pack", "quantity"?: number }`
- **Response**: `{ "url": "https://checkout.stripe.com/..." }`

### B. Stripe Webhook (`POST /api/webhook/stripe`)
Handles real-time sync of economy state.
- **Headers**: Requires valid `stripe-signature`.
- **Events Processed**:
  - `checkout.session.completed`: Provisions premium tier or adds Rapido pens.
  - `customer.subscription.deleted`: Revokes premium tier.
- **Idempotency**: Checked against the `stripe_events` database table.

### C. AI Generation Proxy (`POST /api/ai-generate`)
The central intelligence conduit.
- **Auth**: Requires `Authorization: Bearer <appwrite_jwt>`.
- **Payload**:
  ```json
  {
    "operation": "SINGLE_JURY" | "PREMIUM_RESCUE" | "MULTI_JURY" | "DEFENSE" | "...",
    "imageBase64": "<base64_string>",
    "imageMimeType": "image/jpeg" | "application/pdf",
    "params": {
      "topic": "Housing",
      "category": "Concept",
      "harshness": 4,
      "pdfText": "Optional extracted OCR text...",
      "userMessage": "For Defense mode...",
      "chatHistory": "Array of previous messages..."
    }
  }
  ```
- **Execution**:
  1. Validates JWT and retrieves user ID.
  2. Evaluates cost from `lib/pricing.ts`. Deducts Rapido if sufficient balance exists.
  3. Constructs the prompt based on `operation` and `params.harshness`.
  4. Calls the LLM requesting strict `application/json` output.
  5. Updates `game_state` (progression score, badges) if applicable.
- **Response**:
  ```json
  {
    "result": "<Stringified JSON from LLM>",
    "rapido_remaining": 42,
    "game_state": { "progression_score": 150, "new_badges": [] }
  }
  ```

---

## 4. Data Model Tables

The Appwrite database acts as the source of truth, enforced via document permissions and server-side validation.

### `profiles`
The central user record, linked 1-to-1 with Appwrite Auth.
- `id` (uuid, PK): Matches auth.users.id
- `rapido_pens` (int): Virtual currency balance.
- `is_premium` (boolean): Subscription flag.
- `progression_score` (int): Gamification XP.
- `wall_of_death_count` (int): Number of brutal critiques received.
- `earned_badges` (jsonb): Array of unlocked achievement IDs.
- `stripe_customer_id` (text): Link to Stripe.
- `stripe_subscription_id` (text): Link to active Stripe sub.
- `edu_verified` (boolean), `edu_email` (text): Academic discount identifiers.

### `gallery_submissions`
Records of user projects submitted to the public gallery.
- `id` (uuid, PK)
- `user_id` (uuid, FK to profiles)
- `image_path` (text): Supabase Storage path.
- `public_url` (text): Resolved URL.
- `critique_data` (jsonb): The AI JSON output.
- `gallery_type` (text): `HALL_OF_FAME` | `WALL_OF_DEATH`.
- `status` (text): `pending` | `approved` | `rejected`.

### `stripe_events`
Idempotency ledger for webhooks.
- `id` (text, PK): Stripe Event ID.
- `type` (text): Event type (e.g., `checkout.session.completed`).
- `created_at` (timestamp)

---

## 5. AI Flow & Prompt Engineering

All AI interactions enforce structured JSON outputs from the LLM. The system dynamically injects context based on the current application state.

1. **Context Enrichment**:
   - The frontend optionally extracts text from PDFs (`pdfjs-dist`) to supply the LLM with textual context (labels, legends) that vision models often miss.
   - User inputs (Concept, Site, Topic) are concatenated.
2. **Persona Injection**:
   - Based on the selected `JuryPersonaId` (e.g., Constructive, Grumpy, Contextualist) and the `harshness` slider (1-5), the prompt instructs the model to adopt a specific tone. A 5/5 harshness forces brutal, unforgiving critique.
3. **Execution Modes (`operation`)**:
   - `SINGLE_JURY`: Standard singular critique.
   - `MULTI_JURY`: Instructs the LLM to output three distinct critique nodes representing different sub-personas.
   - `PREMIUM_RESCUE`: Requires bounding-box spatial reasoning. The LLM must return an array of flaws with relative `x, y, width, height` coordinates and practical repair solutions.
   - `DEFENSE`: A stateful, multi-turn chat where the LLM argues back against the user's defense of their project.
4. **Validation**: The Edge Function relies on the LLM's JSON mode but parses and validates the payload before passing it to the frontend.

---

## 6. Stripe & Rapido Economy Flow

The economy hinges on "Rapido" pens as the unit of exchange.

- **Pricing Engine**: lib/pricing.ts defines operation costs globally (e.g., Single Jury = 4, Multi Jury = 10, AI Mentor = 1).
- **Deduction Authority**: The client *never* deducts its own Rapido balance. The Supabase Edge Function reads the database balance, verifies it exceeds the cost, performs the AI call, and deducts the balance in a secure server-side transaction.
- **Purchasing**:
  - Client calls `/api/checkout` with a mode (`premium_monthly`, `rapido_pack`).
  - Stripe Checkout is presented.
  - Upon successful payment, Stripe fires a webhook to `/api/webhook/stripe`.
  - The webhook safely updates `profiles.rapido_pens` or `profiles.is_premium`. The user refreshes or relies on Supabase realtime to see updated balances.

---

## 7. Security Boundaries

1. **Client-Side Restrictions**:
   - The client never handles Stripe Secret Keys or AI API Keys.
   - The client never directly mutates sensitive `profiles` fields (like `rapido_pens`, `is_premium`, `progression_score`).
2. **Document Permissions**:
  - Users can only read and update their own profile document.
  - Security-critical columns in `profiles` (like economy stats) are protected by server-side routes and document permissions from arbitrary client mutations.
3. **API Route Boundary**:
  - `/api/ai-generate` is protected by auth validation and request origin checks.
  - Requires a valid Appwrite JWT. `Authorization` is verified before proceeding.
  - Enforces user-based rate limiting to prevent LLM abuse.
4. **Webhook Integrity**:
   - `/api/webhook/stripe` strictly validates `stripe-signature` against the local `STRIPE_WEBHOOK_SECRET` before processing.
5. **Payload Validation**:
   - File uploads check MIME types and magic bytes (where applicable) to prevent malicious payloads traversing into Storage or the AI model.
