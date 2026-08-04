# feat/private-team-workspace

| Field | Value |
|---|---|
| Priority / phase | P2 / Phase 6 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED — required roles: product + privacy/security + commerce |
| Target | UNSET — assign after revision and tenant-isolation gates |
| Decision gates | D-023 |
| Blocked until | Listed dependencies, owner assignments, and team contract approval are complete |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `fix/guest-account-conversion`, `fix/security-storage-tenant-isolation`, `fix/privacy-data-lifecycle`, `feat/revision-learning-loop`, `fix/core-flow-accessibility`, `fix/http-security-boundaries`, `docs/incident-dr-release-runbooks`, `feat/ai-trust-disclosure` |
| Accountable roles | Product + identity/storage + privacy/security + frontend + QA |

## Outcome

Let one owner create a private collaboration workspace and invite up to five verified teammates to analyze and revise
shared projects with explicit access, ownership, and audit boundaries.

## Evidence

The current product is user-owned and project history is personal. It has no durable team, membership, invite, shared
project, conflict, removal, or cross-team authorization contract.

## Scope

- Create `team`, membership, invite, role, shared-project, and audit contracts with one owner plus five invited members.
- Require verified durable accounts; invite tokens are HMAC-protected, expiring, single-use, revocable, enumeration-safe,
  and bound to the intended identity.
- Support owner/member permissions for inviting, viewing, analyzing, revising, commenting, and removing access.
- Require artifact-owner consent before a personal project becomes team-visible; team sharing never implies public sharing.
- Keep team project lineage, actions, revision comparisons, and analysis provenance visible to authorized members.
- Resolve simultaneous edits and analysis requests without lost state or duplicate operations.
- Provide member removal, team export, project unshare, ownership continuity, and deletion/retention behavior.
- Make owner transfer atomic and explicit; owner deletion cannot orphan a workspace, subscription, project, or audit trail.
- Keep personal AI memory/profile inferences outside team prompts; use only explicitly shared project/team context.
- Keep the workspace hidden from general sale until shared Rapido and packaging contracts are ready.

## Non-goals

No shared Rapido implementation, school roster/cohort, public community, SSO, organization hierarchy, file ownership
guessing, or automatic transfer of a personal project/balance.

## Acceptance criteria

- [ ] A team has exactly one owner and no more than five invited active members beyond the owner.
- [ ] Anonymous, unverified, expired, replayed, wrong-recipient, and over-capacity invites fail.
- [ ] User A cannot access Team B membership, project, file, action, analysis, export, or audit data.
- [ ] Sharing requires explicit owner action and removing a member ends access immediately without deleting source data.
- [ ] Removal/unshare invalidates cached and signed access; owner transfer cannot produce zero or multiple owners.
- [ ] Personal projects, AI memory, profile inference, and personal Rapido never become team-visible by membership alone.
- [ ] Every team analysis/revision records team, project, initiator, permission snapshot, operation, and result provenance.
- [ ] Concurrent edits/requests do not lose actions, duplicate analysis, or cross project/team boundaries.
- [ ] Keyboard, mobile, reduced-motion, and accessible invite/member/project controls pass the core gate.
- [ ] Create → invite → accept → share → analyze → revoke → export passes an end-to-end production-path test.

## Approval and migration boundary

D-023 records the owner's decision: one owner plus up to five invited verified members. The v1 permission, ownership,
transfer, and deletion matrix still requires product/privacy/security/data-migration approval.

## Rollout

Schema and authorization tests → internal synthetic teams → invite-only canary → shared-project/revision verification →
hold general sale until `feat/shared-team-rapido-pool` and `feat/team-packaging` pass.

## Rollback

Disable new invites and team mutations while preserving personal accounts, source ownership, immutable audit evidence,
and read-only authorized export. Never make team data public or transfer ownership as rollback.

## Metrics and required artifacts

- Primary evidence: Invite acceptance, first shared project, team revision completion, access denials, conflicts, and support burden.
- Required artifacts: role/access matrix, two-team integration tests, migration plan, rollout log, rollback proof, and contracts/docs.
