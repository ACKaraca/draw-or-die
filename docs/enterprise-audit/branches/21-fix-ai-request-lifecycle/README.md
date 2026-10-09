# fix/ai-request-lifecycle

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 4 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-010 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | L / High |
| Base | Protected `dev-main` |
| Depends on | `fix/ai-model-lifecycle`, `fix/atomic-rapido-ledger`, `feat/operational-observability` |
| Accountable roles | AI/platform + commerce + QA |

## Outcome

Bound, cancel, retry, and bill each AI operation exactly once across client, server, provider, and wallet.

## Evidence

Client timeout uses `Promise.race`, downstream fetch has no AbortController/server deadline, most operations have no provider output budget, and a retry can overlap continuing cost/side effects.

## Scope

- Propagate client disconnect/cancel through an operation AbortSignal where safe.
- Define operation-specific total deadline, per-attempt timeout, output budget, and maximum estimated cost.
- Classify retryable 408/429/5xx/transport failures and honor `Retry-After` inside one deadline.
- Use one operation/idempotency ID across provider attempts, ledger reservation, persistence, and client retry.
- Void reservations for cancel/timeout/refusal/invalid output and settle only accepted output.
- Return typed retryability/error codes and preserve user input for recovery.

## Non-goals

No prompt redesign, model-quality promotion, or UI animation redesign beyond accurate recovery state.

## Acceptance criteria

- [ ] Hung provider request is aborted at the deadline.
- [ ] Client disconnect/cancel stops downstream work and creates no later state/charge.
- [ ] Same operation ID produces at most one accepted result and settlement.
- [ ] Retry never exceeds attempt, deadline, output, or cost cap.
- [ ] Non-retryable validation/auth/capability/safety failures are not retried blindly.
- [ ] Timed-out/cancelled/refused/invalid requests settle zero Rapido.
- [ ] Latency, attempt, actual model, usage, and outcome telemetry reconcile to the ledger.

## Approval and migration boundary

Deadline/retry/cost caps require operation-owner and commerce approval. Do not mask provider failure as filler success.

## Rollout

Characterize current operations → implement one low-risk operation → fault-injection staging → cohort canary → migrate remaining operations.

## Rollback

Disable the affected operation or use the last bounded adapter; never return to unbounded duplicate-billing behavior.

## Metrics and required artifacts

- Primary evidence: Post-timeout side effects zero; duplicate settlement zero; abort/retry/void rates and accepted latency.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
