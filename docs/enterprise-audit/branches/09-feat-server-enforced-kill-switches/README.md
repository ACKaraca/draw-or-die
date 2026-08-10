# feat/server-enforced-kill-switches

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 2 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | None — branch approval only |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | M / Medium |
| Base | Protected `dev-main` |
| Depends on | `fix/staging-artifact-promotion` |
| Accountable roles | Platform/SRE + security + domain owners |

## Outcome

Let operators stop risky side effects safely without shipping a new build.

## Evidence

Feature flags are limited and some fail open; expensive AI, reward, checkout, public-write, and incomplete ArchBuilder/community behavior lack consistent server enforcement.

## Scope

- Create server-enforced switches for AI spend, reward grants, Checkout creation, public writes, and incubating surfaces.
- Define safe defaults when configuration cannot be loaded.
- Preserve inbound Stripe events while pausing their processor rather than dropping delivery.
- Audit actor, reason, prior/new value, environment, expiry, and approval.
- Support environment/cohort/percentage rollout only where deterministic and safe.

## Non-goals

No generic experimentation platform or client-authoritative feature flags.

## Acceptance criteria

- [ ] Client input cannot override a disabled server capability.
- [ ] Configuration outage disables costly/grant/public-write mutations safely.
- [ ] Inbound financial events are retained for later replay.
- [ ] Switch change is authenticated, audited, expires where appropriate, and alerts the owner.
- [ ] Emergency disable is verified in staging synthetic tests.
- [ ] ArchBuilder/Confessions hold state is truthful in UI and API.

## Approval and migration boundary

Financial and public-write switch policies require security/commerce approval. A switch cannot bypass data migration safety.

## Rollout

Ship all switches disabled in observe-only evaluation where possible, verify config and audit, then adopt as rollout controls for later branches.

## Rollback

Use the switch to hold the affected capability; preserve queued/source events and customer state.

## Metrics and required artifacts

- Primary evidence: Time to disable; unaudited changes zero; side effects while disabled zero.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
