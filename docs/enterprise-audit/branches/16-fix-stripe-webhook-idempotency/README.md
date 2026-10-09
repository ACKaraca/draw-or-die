# fix/stripe-webhook-idempotency

| Field | Value |
|---|---|
| Priority / phase | P0 / Phase 3 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | None — branch approval plus event-specific incident/change record |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | M–L / High |
| Base | Protected `dev-main` |
| Depends on | `fix/atomic-rapido-ledger`, `feat/operational-observability` |
| Accountable roles | Commerce + data + SRE + QA |

## Outcome

Process each Stripe event exactly once in effect while preserving safe retry after partial failure.

## Evidence

`markStripeEventProcessed` is called before the event's business side effect; a failure can return 500 but the next delivery is skipped as already processed. The guard can fail open if storage is unavailable.

## Scope

- Use durable `received → processing → succeeded | failed` state with lease/attempt/error metadata.
- Claim work atomically and mark success only after the complete idempotent effect commits.
- Preserve failed events for retry/replay and handle lease expiry.
- Connect each effect to immutable ledger/entitlement source IDs.
- Expose queue age, attempts, failure, duplicate, and reconciliation metrics.

## Non-goals

No premium allowance/product/refund policy change; those belong to entitlement reconciliation.

## Acceptance criteria

- [ ] Duplicate delivery creates one business effect and one succeeded event.
- [ ] Injected failure after claim/before/after each side effect retries to one correct result.
- [ ] Two workers cannot process the same lease concurrently.
- [ ] Failed events remain replayable without deletion or manual database edits.
- [ ] Unknown event types are acknowledged and auditable without side effects.
- [ ] Signature, livemode/account, and source identifiers remain validated.

## Approval and migration boundary

Replaying production events or changing event state requires commerce/operator approval and a dry-run reconciliation.

## Rollout

Shadow-record new state alongside current handling, then process a test-mode replay corpus, then enable for a bounded event type before all supported events.

## Rollback

Pause the processor, retain inbound events, deploy a fix, and replay. Never delete events or mark failed work succeeded.

## Metrics and required artifacts

- Primary evidence: Duplicate/lost effect zero; failed-event age; processing lease age; source-event reconciliation.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
