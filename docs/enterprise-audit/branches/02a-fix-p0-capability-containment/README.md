# fix/p0-capability-containment

| Field | Value |
|---|---|
| Priority / phase | P0 / Phase 0 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | None — incident/change approval and live hold inventory required |
| Blocked until | `fix/release-build-blockers` and an approved hotfix target/rollback are complete |
| Effort / delivery risk | S–M / High |
| Base | Verified recovery baseline through the approved hotfix lane |
| Depends on | `fix/release-build-blockers` |
| Accountable roles | Incident commander + security + commerce + AI/storage owners |

## Outcome

Implement narrow fail-closed server guards so incident holds remain enforceable while permanent ledger, Stripe, storage,
identity, and AI remediations follow their safe dependencies.

## Evidence

The audit found active P0 classes whose full fixes require migrations and staged rollout: automatic publication,
unverified rewards, guest Checkout, non-atomic Rapido, early Stripe event completion, broad storage mutation, and a
retired AI default.

## Scope

- Implement the approved [P0 containment runbook](../../P0-CONTAINMENT-RUNBOOK.md) hold matrix as server-enforced guards.
- Reject automatic/public writes and public delivery without a verifiable explicit-consent marker.
- Reject new rewards and every new subscription/Rapido Checkout while its commerce hold is active; preserve portal,
  cancellation, refund, and support access.
- Reject education-code issue/verify while held, remove verification metadata from the public profile DTO, and ensure
  the verifier never accepts the legacy plaintext format.
- Reject broad direct client storage mutation and require existing owner-validating server authorization or deny access.
- Reject paid AI operations when model policy or wallet safety is unverified.
- Separate signed Stripe event intake from side-effect processing so a processing hold retains replayable events.
- Default every guard to the restrictive state when configuration cannot be loaded or verified.

## Non-goals

No ledger/storage migration, historical deletion, price change, event deletion, entitlement clawback, or full feature-flag
platform.

## Acceptance criteria

- [ ] Automatic public write, unverified reward, and broad direct file mutation are zero while held.
- [ ] Public delivery of a gallery record without verifiable explicit consent is zero while held.
- [ ] New Checkout is zero while Stripe effects are paused; successful payment without reconciled entitlement is zero.
- [ ] Portal, cancellation, refund, and support paths remain available while new Checkout is held.
- [ ] Client-visible OTP material and successful legacy-plaintext verification are zero.
- [ ] Unsupported/retired model configuration cannot accept a paid operation.
- [ ] Signed Stripe events remain durable and replayable while processing is paused.
- [ ] Configuration failure defaults to no risky side effect.
- [ ] Every hold has owner, reason, environment, release/config version, start, review, and re-enable gate.
- [ ] User-facing unavailable states are truthful and preserve customer data/value.

## Approval and migration boundary

Containment code requires incident-owner approval and must be restrictive and reversible. No customer data is deleted
or balance adjusted. Operator holds are owned by the [P0 containment runbook](../../P0-CONTAINMENT-RUNBOOK.md); urgent
additive state follows [the emergency protocol](../../EMERGENCY-CHANGE-PROTOCOL.md).

## Rollout

After the operator runbook establishes the restrictive holds, ship the narrow guards through the verified hotfix lane,
verify fail-closed behavior, and keep the holds active until each permanent branch closes.

## Rollback

Re-enable a capability only after its permanent branch acceptance and live verification pass. A rollback cannot reopen
automatic publishing, plaintext OTP, unverified rewards, unreconciled Checkout, broad storage mutation, or a retired
model. Historical gallery delivery may reopen only for consent-proven records or after the approved remediation branch.

## Metrics and required artifacts

- Primary evidence: risky side effects while held equal zero; retained Stripe/source events reconcile.
- Required artifacts: live-state snapshot, incident decision, hold inventory, user-impact copy, re-enable checklist.
