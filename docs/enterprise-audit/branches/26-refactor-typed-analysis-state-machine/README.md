# refactor/typed-analysis-state-machine

| Field | Value |
|---|---|
| Priority / phase | P2 / Phase 5 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-013 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | L / Medium |
| Base | Protected `dev-main` |
| Depends on | `fix/revision-continuity`, `chore/critical-contract-harness` |
| Accountable roles | Frontend/product engineering + QA |

## Outcome

Make impossible analysis, account, payment, and recovery UI states unrepresentable.

## Evidence

A broad Zustand store uses step strings plus optional fields; result/revision/account/premium views can render with missing or contradictory data and persistence migrations are implicit.

## Scope

- Define discriminated states for prepare, submitting, analyzing, result, failure, cancelled, and revision context.
- Separate account and entitlement facts confirmed by server from optimistic UI intent.
- Use exhaustive transition reducers and typed events.
- Version and migrate persisted state; discard unsafe stale state explicitly.
- Map validation/auth/balance/provider/timeout/cancel/retry failures to recoverable states.
- Add compatibility adapter so screen migration is incremental.
- Preserve the locked save→reopen→revise production-path contract throughout migration.

## Non-goals

No whole-app route rewrite, component visual redesign, or new feature.

## Acceptance criteria

- [ ] Result cannot exist without project/run/result provenance.
- [ ] Revision cannot start without a durable base artifact/project.
- [ ] Premium/payment success cannot be created by URL/client state.
- [ ] Every switch is exhaustive and invalid transitions are rejected/tested.
- [ ] Persisted old/partial/corrupt state migrates or resets safely without leaking another account.
- [ ] Retry/cancel/session-expiry preserves the intended file/form context.
- [ ] One vertical screen slice migrates without unrelated component churn.

## Approval and migration boundary

Persisted-state migration and user-visible recovery behavior require product approval; never silently discard durable server data.

## Rollout

Introduce types/adapter → migrate one flow slice → compare state telemetry → migrate remaining screens in later small PRs.

## Rollback

Use the compatibility adapter for the affected screen while retaining versioned persisted-state migration.

## Metrics and required artifacts

- Primary evidence: Invalid-transition count zero; recoverable failure completion; stale-state reset and duplicate submission rate.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
