# AGENTS.md — Draw or Die

Authoritative instructions for all AI coding agents (Claude, Codex, Copilot, Cursor, Jules, etc.). Read fully before any change. The owner is a non-expert solo developer with ADHD; ~99% of code is AI-written, models change frequently. Your top priority is **predictable, project-consistent, near-zero-defect output**.

---

## 1. Project

**Draw or Die** — AI architectural jury simulator. User uploads drawing/PDF, gets multi-persona critique at chosen harshness, lands in Hall of Fame or Wall of Death.

- Prod: `https://drawordie.app` (branch: `main`)
- Dev:  `https://dev.drawordie.app` (branch: `dev-main`)
- Appwrite project: `draw-or-die` (fra.cloud.appwrite.io)
- Repo: `ACKaraca/draw-or-die` (only remote — no fork)

---

## 2. Branch & Release Strategy (CRITICAL)

| Branch | Site | Purpose | Version bumps |
|---|---|---|---|
| `main` | `drawordie.app` | Production. Major releases only. | `V.1 → V.2` (major) |
| `dev-main` | `dev.drawordie.app` | Active development, default workspace. | `V.x.1 → V.x.2` (minor/patch) |
| `feat/*`, `fix/*`, `chore/*` | preview | Short-lived, branched from `dev-main`, merged via PR. | — |

### Working Rules
- **Default to `dev-main` for ~90% of work.** Only touch `main` for big-picture releases or hotfixes the owner explicitly approves.
- Never push directly to `main`. Always go via PR from `dev-main` or a release branch.
- Branch names: kebab-case, prefixed (`feat/`, `fix/`, `chore/`, `refactor/`, `docs/`).
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `perf:`, `ci:`).

### 🚨 Version-Bump Nudge (MANDATORY OUTPUT BLOCK)
At the **end of every response** that touches `dev-main` or any branch downstream of it, count uncommitted+unmerged work since last `main` merge. If **any** of the following is true, append the block below to your reply:

- ≥ 8 commits on `dev-main` since last sync to `main`, OR
- ≥ 3 net-new user-facing features, OR
- ≥ 1 breaking schema/API change.

Block format (use exactly, with emojis, in Turkish):

```
---
✨🚀 **VERSİYON GÜNCELLEMESİ ÖNERİLİR** 🚀✨
📊 dev-main üzerinde {N} commit / {M} özellik birikti.
🎯 Önerim: `V.x → V.(x+1)` olarak `main`'e merge etmeye hazır olabilir.
👉 Onaylarsan PR'ı açayım mı?
---
```

Do **not** show this block on `main` work, doc-only edits, or trivial fixes. Never inflate counts to trigger it.

---

## 3. ADHD-Aware Collaboration Protocol

The owner may send prompts that are **contradictory, switch direction mid-message, or mix high-level intent with micro-detail**. Adapt with this protocol:

1. **Detect conflict.** If two requests in one prompt contradict (e.g., "kaldır" + "geliştir" same feature), DO NOT pick one silently. List both, ask one short clarifying question, then proceed.
2. **Confirm destructive intent.** Before deleting files, dropping tables, force-pushing, or removing features, repeat the action in one Turkish sentence and wait for `evet` / `tamam` / explicit go-ahead.
3. **Stay in scope.** If the prompt drifts (e.g., asks for AGENTS.md edit but also a refactor), execute the primary ask, then list the secondary asks as a numbered TODO at the end — don't silently bundle.
4. **Keep replies short, structured, Turkish.** No filler ("Tabii ki!", "Harika fikir!"). Lead with what was done, end with what's next.
5. **Never assume technical knowledge.** Explain trade-offs in plain Turkish when the owner's instruction implies a misunderstanding (e.g., "force push to main" → warn first).
6. **Preserve previous versions.** When refactoring, keep the old logic in git history (no rebase-squash that erases context). Do not delete alternate implementations the owner kept on purpose.

---

## 4. AI-Model Consistency Rules (read every session)

Different models write different styles. To keep the codebase coherent regardless of which AI wrote a file, **follow these conventions verbatim**:

### Imports
- Always use `@/` path alias. Never relative `../../`.
- Group order: (1) node/builtin, (2) external packages, (3) `@/` internal, (4) types (`import type`). Blank line between groups.
- No inline `require()` or dynamic `import()` unless needed for code-splitting.

### Types & TS
- `tsconfig` is `strict`. Never widen with `any`. Use `unknown` + narrowing if the shape is unknown.
- Public functions: explicit return type. Internal helpers: inferred OK.
- Discriminated unions for state machines (`type Step = { kind: 'hero' } | { kind: 'upload', file: File }`).
- All exhaustive `switch` on a union must end with `default: const _exhaustive: never = value; throw new Error(...)`.

### React / Next
- Functional components + hooks only. No class components.
- Server components by default in `app/`; add `'use client'` only when needed (state, refs, browser APIs).
- One component per file. Filename = component name (`PascalCase.tsx`).
- Props: `type Props = { ... }`; destructure in the signature.
- No inline `useEffect` for data fetching when a server component or `useSWR`/route handler suffices.

### Naming
- Variables/functions: `camelCase`. Types/components: `PascalCase`. Constants: `SCREAMING_SNAKE_CASE`. Files: kebab-case for non-components, PascalCase for components.
- Boolean names: `is*`, `has*`, `can*`, `should*`. Never negative (`isNotReady` ❌ → `isReady` ✅).

### Style
- 2-space indent, single quotes, trailing commas, semicolons. ESLint + Prettier defaults — let the linter format, don't fight it.
- Max line length: 120. Break long JSX onto multiple lines.
- Comments only for **non-obvious intent / trade-offs**. Never narrate code (`// loop over users` ❌).

### Errors
- Throw `Error` subclasses, not strings. Server routes return `NextResponse.json({ error: '...' }, { status })`.
- Always `try/catch` around: external API calls, `JSON.parse`, file I/O, Stripe/Appwrite SDK calls.
- Log via `lib/logger.ts`, never `console.log` in shipped code (only allowed in scripts/).

### File-shape template (TS module)
```ts
import { something } from '@/lib/something';
import type { Foo } from '@/types';

export const CONSTANT = 42;

export function publicHelper(input: Foo): string { /* ... */ }

function internalHelper() { /* ... */ }
```

---

## 5. Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript strict |
| Styling | Tailwind CSS + Framer Motion |
| State | Zustand (`stores/drawOrDieStore.ts`) |
| Auth/DB/Storage | Appwrite |
| AI | Google Gemini via OpenAI-compatible REST |
| Payments | Stripe (subs + token packs) |
| PDF | `pdfjs-dist` |
| Tests | Jest + Playwright |
| Deploy | Vercel |

---

## 6. Folder Layout (high-level)

```
app/         Next.js routes; api/* contains all server routes
components/  React components (PascalCase per file)
hooks/       Custom hooks (useXxx)
lib/         Pure logic, SDK init, helpers
  pricing.ts            single source of truth for Rapido + Stripe IDs
  i18n.ts               localization (tr default, en secondary)
  appwrite/             server.ts (admin), client.ts, error-utils.ts
  rate-limit.ts, logger.ts, ai.ts, critique.ts
stores/      Zustand stores
types/       Shared TS types
docs/        ARCHITECTURE.md, API.md, ENVIRONMENT.md
scripts/     Build, deploy, validation scripts (allowed to use console)
```

---

## 7. Language Policy

| Layer | Language |
|---|---|
| LLM responses (jury critique, mentor) | **English** |
| Source code, comments, identifiers | **English** |
| Docs (AGENTS.md, docs/, README) | **English** |
| User-facing UI strings | **Turkish first, then English** via `lib/i18n.ts` (`pickLocalized`) |
| Chat replies to the owner | **Turkish, concise** |

Never hardcode locale strings outside `lib/i18n.ts` or translation data. Always provide both `tr` + `en` for new UI strings.

---

## 8. Step State Machine

`StepRouter.tsx` reads `step` from `drawOrDieStore` and renders:

```
hero → upload → analyzing | premium-analyzing | multi-analyzing
              → result | premium | multi-result
              → gallery | ai-mentor | profile | history
              → premium-upgrade | rapido-shop
```

`app/page.tsx` is a thin shell — providers + `<StepRouter />` only.

---

## 9. Rapido Economy

All costs live **only** in `lib/pricing.ts`. Never hardcode values elsewhere.

**Costs:** SINGLE_JURY 4 · REVISION_SAME 1 · REVISION_DIFFERENT 2 · MULTI_JURY 10 · MULTI_JURY_REVISION 2 · AUTO_CONCEPT 5 · MATERIAL_BOARD 3 · DEFENSE 4 · AI_MENTOR 3/1k tokens · PREMIUM_RESCUE 6.

**Starting balance:** Guest/Anon 4 · Registered 15 (one-time) · Premium 200 (monthly).

**Premium-only:** MULTI_JURY*, MATERIAL_BOARD, DEFENSE, AI_MENTOR.

**🔒 Critical:** the client never deducts its own balance. All deductions happen server-side in `/api/ai-generate` after JWT validation.

---

## 10. AI Prompting Rules

- **JSON mode mandatory:** every LLM call sends `responseMimeType: "application/json"` + strict JSON schema.
- Inject **harshness 1–5** into prompt. `5/5` = brutal tone.
- Specify **persona ID** (`constructive | structural | conceptual | grumpy | contextualist | sustainability`).
- Append **`pdfText`** (extracted via `pdfjs-dist`) to prompts so vision model reads labels.
- `PREMIUM_RESCUE` returns relative bbox coords (`x, y, width, height`).
- `DEFENSE` is multi-turn (`turnCount` ≤ 3); send full chat history every call.
- LLM output is always English regardless of user locale.

---

## 11. Security Boundaries

- Secrets (`STRIPE_SECRET_KEY`, `APPWRITE_API_KEY`, `AI_API_KEY`) **never** ship to the client bundle. Test with `npm run check:secrets`.
- `rapido_pens`, `is_premium`, `progression_score` mutated **only** from server routes.
- `/api/ai-generate` validates `Authorization: Bearer <appwrite_jwt>` on every call.
- Rate limiting active via `lib/rate-limit.ts`.
- Stripe webhook verifies `stripe-signature` against `STRIPE_WEBHOOK_SECRET`. Idempotency via `stripe_events` table.
- File uploads: validate MIME, size, magic bytes.
- CORS: no `*` in `ALLOWED_ORIGINS`.
- Never write secrets in code or comments. Use `process.env.*` and document in `docs/ENVIRONMENT.md`.

---

## 12. Stripe Tiers

Tier auto-resolved by email in `lib/pricing.ts → resolveStripeTierForUser`:

| Tier | Criteria | Monthly | Yearly |
|---|---|---|---|
| `AKDENIZ_STUDENT` | `@akdeniz.edu.tr` | 149 TRY | 1,249 TRY |
| `TR_STUDENT` | `.edu.tr` | 299 TRY | 2,499 TRY |
| `GLOBAL` | other | $15 | $129 |

Rapido packs: same per-unit price (`RAPIDO_UNIT`), min 5 units.

---

## 13. Appwrite Data Model (snapshot)

- `profiles` — one per user. Server-only writes for `rapido_pens`, `is_premium`, `progression_score`, `wall_of_death_count`, `earned_badges`, Stripe IDs, `edu_*`.
- `gallery_submissions` — `user_id`, `image_path`, `public_url`, `critique_data`, `gallery_type` (`HALL_OF_FAME | WALL_OF_DEATH`), `status` (`pending | approved | rejected`).
- `stripe_events` — Stripe idempotency ledger (PK: event ID).
- Other tables (mentor, promo, referral, feedback, etc.) — see `lib/appwrite/server.ts` exports.

---

## 14. Pre-Delivery Checklist (RUN EVERY TASK)

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run test        # Jest
```

For risky changes (auth, payments, AI route, schema):
```bash
npm run test:e2e:smoke
npm run check:secrets
npm run check:stripe-config
```

If any command fails → fix before declaring done. Never silence a lint rule with `eslint-disable` unless you also add a one-line comment explaining why.

---

## 15. Change Management

- Prefer **minimal, reversible** changes. Don't refactor unrelated code.
- Preserve existing API/data/UI contracts unless explicitly asked to change them.
- Add validation + error handling to every mutation.
- For destructive ops (delete files, drop tables, force-push, schema changes): **stop and ask first** (see §3.2).
- New deps: justify in 1 line. Avoid heavy libs when 20 lines of code suffices.
- Preserve old/alternate versions the owner kept on purpose. Do not squash-rebase history that loses context.

---

## 16. PR Checklist (paste into PR body)

```
- [ ] Branched from `dev-main` (or `main` for hotfix)
- [ ] `npm run lint` ✓
- [ ] `npm run typecheck` ✓
- [ ] `npm run test` ✓
- [ ] No new `any`, no new `console.log` in app code
- [ ] No hardcoded secrets / Stripe IDs / Rapido costs
- [ ] User-facing strings via `lib/i18n.ts` (tr + en)
- [ ] Updated docs if API/schema/env changed
```

---

## 17. References

- Architecture: `docs/ARCHITECTURE.md`
- API contracts: `docs/API.md`
- Env vars: `docs/ENVIRONMENT.md`
