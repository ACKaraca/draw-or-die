# refactor/app-router-boundaries

| Field | Value |
|---|---|
| Priority / phase | P2 / Phase 5 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-013 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `refactor/typed-analysis-state-machine`, `chore/critical-contract-harness`; does not block revision MVP |
| Accountable roles | Frontend/platform + product + SEO + QA |

## Outcome

Move one durable destination at a time from the client pseudo-router to real App Router boundaries with better recovery, deep linking, metadata, and bundle isolation.

## Evidence

`app/page.tsx` is a client-heavy orchestrator, many screens are statically imported, distinct routes re-export or diverge from the core shell, and route loading/error/not-found boundaries are missing.

## Scope

- Define public marketing, authenticated application, and incubating-surface layout boundaries.
- Add loading, error, and not-found conventions plus shared navigation/breadcrumb ownership.
- Keep public pages server-rendered/cacheable where possible and dynamic auth reads narrow.
- Migrate one low-risk route slice behind a compatibility adapter.
- Verify URL, refresh, browser back/forward, auth, locale, metadata, and bundle behavior.
- Lazy-load expensive workspace/incubation surfaces.

## Non-goals

No all-screen migration, product-shell duplication, visual redesign, or Zustand removal in one PR.

## Acceptance criteria

- [ ] The first route slice deep-links, refreshes, and navigates back/forward without lost or impossible state.
- [ ] Server/client boundaries do not leak secrets or duplicate authenticated requests.
- [ ] Route-specific loading/error/not-found recovery is accessible.
- [ ] Public slice has correct canonical/locale/cache behavior.
- [ ] Bundle and interaction performance do not regress beyond the approved budget.
- [ ] Existing pseudo-router flows remain characterized through the adapter.
- [ ] Each later slice can be a separate small PR/branch.

## Approval and migration boundary

Route/URL/SEO contract and persisted navigation-state changes require product/SEO approval. Avoid parallel `unified-product-shell` work on the same surface.

## Rollout

Document route map → add shared boundaries → migrate one slice → canary/deep-link test → repeat only after evidence.

## Rollback

Route the affected destination through the compatibility adapter while preserving new URLs or redirects; do not remove all boundaries.

## Metrics and required artifacts

- Primary evidence: Deep-link/recovery pass, bundle size, server/client error rate, navigation-state loss zero.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
