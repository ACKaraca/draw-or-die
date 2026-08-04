# chore/critical-contract-harness

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 2 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | None — branch approval only |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | L / Low–Medium |
| Base | Protected `dev-main` |
| Depends on | `fix/release-build-blockers`, `fix/repository-release-gates` |
| Accountable roles | QA + domain engineers + security |

## Outcome

Make critical tests exercise production authorization, billing, file, AI, and persistence paths rather than copied examples.

## Evidence

There are 35 API route files but only two direct route test files; important security tests reimplement helpers, route/store coverage is excluded, E2E is shallow, and partial statement coverage is 8.96%.

## Scope

- Include API routes, stores, and domain services in coverage and establish a ratchet after the suite is green.
- Create route/integration harnesses with real auth states, two users, signed Stripe fixtures, and Appwrite/storage adapters.
- Cover replay, concurrency, timeout, partial failure, permission, and rollback conditions.
- Add core browser journeys for guest conversion, upload/PDF, AI, Rapido, Checkout/webhook, cancellation, and consent.
- Separate deterministic provider mocks from a bounded real-provider canary.

## Non-goals

No arbitrary 100% coverage target or snapshot-heavy test rewrite.

## Acceptance criteria

- [ ] All existing 37 suites pass before a new threshold is enforced.
- [ ] Security tests import or call production code and fail when the known vulnerable behavior is reintroduced.
- [ ] Every money/identity/publication/storage route has negative authorization and replay coverage.
- [ ] E2E proves the deployed target URL and release SHA.
- [ ] Coverage cannot decrease and critical policy branches have explicit higher thresholds.
- [ ] No live Stripe charge or private eval artifact is used in PR tests.

## Approval and migration boundary

Test data must be synthetic or explicitly permitted. Security fixtures and provider secrets stay outside artifacts/logs.

## Rollout

Fix suite loading, add critical characterization tests before implementation branches, then ratchet coverage per merged vertical slice.

## Rollback

Revert flaky test implementation, not the underlying required behavior; quarantine only with owner, reason, expiry, and replacement plan.

## Metrics and required artifacts

- Primary evidence: Critical route contract coverage and escaped-regression count; flaky-test rate below the agreed threshold.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
