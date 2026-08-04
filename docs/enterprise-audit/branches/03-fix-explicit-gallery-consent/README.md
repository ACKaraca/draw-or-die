# fix/explicit-gallery-consent

| Field | Value |
|---|---|
| Priority / phase | P0 / Phase 1 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-005 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | M–L / High |
| Base | Protected `dev-main` |
| Depends on | `fix/release-build-blockers`, `fix/repository-release-gates`, `fix/p0-capability-containment` |
| Accountable roles | Product + privacy/security + gallery engineering + QA |

## Outcome

Make every analysis private by default and require explicit, recorded, revocable publishing consent.

## Evidence

Non-premium analysis hooks can submit `autoApproved: true`; the gallery API trusts it, while Upload copy says projects stay private and the consent UI is premium-only.

## Scope

- Remove every automatic gallery POST/upload from analysis completion.
- Remove `autoApproved` from the client contract; moderation state is server-owned.
- Use the same explicit publish choice for guest, registered, and premium experiences.
- Require durable ownership and management or disallow guest publishing.
- Record consent scope/version/time and support revoke/archive without exposing private source by default.
- Produce a read-only inventory of potentially historical auto-published records.

## Non-goals

Do not delete, archive, or claw back historical records in this branch; do not build new social engagement.

## Acceptance criteria

- [ ] No gallery database or storage write occurs before a publish action.
- [ ] Choosing private creates no gallery artifact.
- [ ] Client attempts to set approval status are rejected or ignored.
- [ ] Provider/moderation uncertainty cannot produce `approved`.
- [ ] Guest content is either blocked or manageable/revocable by its durable owner.
- [ ] Production hook + route integration and two-user ownership tests catch the existing regression.
- [ ] `publish_without_explicit_consent` remains exactly zero.

## Approval and migration boundary

Historical remediation is a separate destructive-data decision requiring explicit owner approval after the inventory. Consent rollback may never restore automatic publishing.
Emergency execution must follow the [emergency change protocol](../../EMERGENCY-CHANGE-PROTOCOL.md).

## Rollout

Disable public writes with the server kill switch if available, deploy private-by-default behavior, verify new records, then re-enable only explicit submissions.

## Rollback

Keep public writes disabled while fixing a regression. Never roll back to client-owned approval or automatic publish.

## Metrics and required artifacts

- Primary evidence: Unauthorized publish invariant zero; consent grant/revoke and privacy-support events observable.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
