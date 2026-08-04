# fix/guest-account-conversion

| Field | Value |
|---|---|
| Priority / phase | P0 / Phase 1 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-006 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | L / High |
| Base | Protected `dev-main` |
| Depends on | `fix/release-build-blockers`, `fix/repository-release-gates`, `fix/p0-capability-containment` |
| Accountable roles | Identity + product + commerce + QA |

## Outcome

Convert a guest into a durable account without losing or duplicating identity, Rapido, projects, files, or history.

## Evidence

Anonymous sign-in errors are swallowed, the auth modal closes, UI treats any user object as registered, the result CTA opens premium, and Checkout can be created without a durable email identity.

## Scope

- Model `visitor | guest | registered_unverified | registered_verified | premium` explicitly.
- Keep auth errors visible and make the result account CTA open real conversion.
- Preserve the same Appwrite identity where supported; otherwise use an atomic idempotent ownership transfer.
- Reconcile profile, wallet, projects, history, files, referrals, and experiment identity.
- Block Checkout until a durable account/email and recovery path exist.

## Non-goals

No pricing change, referral reward, or new social login beyond the selected conversion methods.

## Acceptance criteria

- [ ] Guest analysis → result → conversion retains one user/profile, balance, file ownership, and result.
- [ ] Retrying conversion is idempotent and creates no duplicate transfer.
- [ ] Failure leaves the modal open, explains recovery, and preserves guest work.
- [ ] Anonymous checkout count is zero.
- [ ] Concurrent conversion/login and session-expiry cases are covered.
- [ ] Analytics stitches guest to registered identity without duplicating the activation.

## Approval and migration boundary

Any cross-user document or storage ownership migration requires explicit owner approval and an auditable dry run.

## Rollout

Shadow-validate conversion mappings, release to internal accounts, then a small guest cohort. Keep checkout blocked until conversion verification is green.

## Rollback

Disable conversion and checkout for guests while preserving all guest data; do not reverse completed ownership transfers automatically.

## Metrics and required artifacts

- Primary evidence: Identity/balance/file loss zero; duplicate profile zero; conversion completion and recoverable failure rate.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
