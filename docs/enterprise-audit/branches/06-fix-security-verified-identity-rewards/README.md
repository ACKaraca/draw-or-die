# fix/security-verified-identity-rewards

| Field | Value |
|---|---|
| Priority / phase | P0 / Phase 1 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-007 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | M–L / High |
| Base | Protected `dev-main` |
| Depends on | `fix/guest-account-conversion`, `fix/security-edu-otp-secrecy` |
| Accountable roles | Security + growth/commerce + identity + QA |

## Outcome

Issue registration, referral, education, peer, and promo value only to eligible verified identities and once per qualified source.

## Evidence

Authentication does not preserve email-verification state in policy, anonymous sessions can receive registered balances, and referral/reward paths lack complete verified-identity and durable uniqueness controls.

## Scope

- Create one server-owned reward eligibility policy by account state and reward type.
- Require unique grant keys and qualified activation for referral rewards.
- Add self/cyclic referral, velocity, replay, and verifier-failure controls.
- Fail closed or pause reward issuance until the atomic ledger is available.
- Audit suspicious historical grants without automatic clawback.

## Non-goals

No reward amount increase, affiliate launch, or historical balance deletion.

## Acceptance criteria

- [ ] Anonymous and unverified reward grants are zero.
- [ ] Duplicate source/retry/concurrent delivery creates at most one grant.
- [ ] Self-referral and simple referral cycles do not grant value.
- [ ] Identity or eligibility dependency failure cannot grant value.
- [ ] Reward state is observable and can be reconciled to its source action.
- [ ] Every reward route calls the same production policy.

## Approval and migration boundary

Historical clawback or user-balance adjustment requires explicit owner/finance approval. Before ledger readiness, the safe fallback is to suspend grants.
Emergency execution must follow the [emergency change protocol](../../EMERGENCY-CHANGE-PROTOCOL.md).

## Rollout

Keep grants paused until both guest conversion and education verification gates pass. Then enable audit-only comparison
before enforcing new sources behind a reward kill switch.

## Rollback

Pause new rewards; preserve source and grant records. Never silently remove customer balance.

## Metrics and required artifacts

- Primary evidence: Unverified/duplicate grants zero; reward-to-qualified-activation ratio and fraud-review queue.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
