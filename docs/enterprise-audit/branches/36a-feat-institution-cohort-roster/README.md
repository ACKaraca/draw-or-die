# feat/institution-cohort-roster

| Field | Value |
|---|---|
| Priority / phase | P3 / Phase 8 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED — required roles: product/education + privacy/security + QA |
| Target | UNSET — assign only after institution tenancy and pilot investment gates |
| Decision gates | D-027, D-028, and D-030 |
| Blocked until | Institution tenancy/RBAC, validated pilot workflows, owners, and learner-access policy are approved |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `feat/institution-foundation`, `feat/revision-learning-loop`, `feat/ai-trust-disclosure`, `fix/core-flow-accessibility` |
| Accountable roles | Education product + institution identity + privacy/security + frontend + QA |

## Outcome

Add the validated cohort, roster, assignment, rubric, and educator/learner workflows on top of proven organization tenancy.

## Evidence

Paid-pilot evidence must identify which cohort decisions and educator workflows justify a reusable platform. Combining
these workflows with tenancy, billing, reporting, and recovery in one branch would create multiple rollback boundaries.

## Scope

- Create tenant-scoped cohorts, terms, roster states, invitations, transfers, removals, and archived membership.
- Implement validated educator/learner assignment and rubric workflows without automatic grading.
- Enforce D-028 for project/artifact ownership, assignment-scoped educator visibility, access logs, and portability.
- Define active-learner state deterministically from approved activity, never roster presence alone.
- Support least-privilege cohort coordinators only if pilot evidence proves the role; otherwise use organization admins.
- Make roster and assignment transitions idempotent, auditable, accessible, and reversible within retention contracts.
- Preserve personal work outside an institution assignment; enrollment alone never exposes all account history or AI memory.

## Non-goals

No institution billing, Rapido funding, aggregate reporting, SSO, surveillance, learner ranking, public classroom,
automatic grading, or recovery-platform implementation.

## Acceptance criteria

- [ ] Cross-organization and cross-cohort list/read/write/export access is zero for every role and roster state.
- [ ] Joining a cohort exposes only explicitly assigned/institution-owned artifacts under D-028, never personal history or memory.
- [ ] Invite, accept, transfer, remove, re-enroll, archive, and concurrent seat-limit transitions are atomic and audited.
- [ ] Educator access has a lawful/contractual basis, visible notice, purpose, expiry, and immutable access record.
- [ ] Removed learners/educators lose new and signed/cached access immediately while portability and audit obligations remain.
- [ ] Active learner, cohort limit, and assignment status are deterministic and available to authorized billing policy only.
- [ ] Keyboard, mobile, screen-reader, localization, and reduced-motion flows pass for all validated roles.

## Approval and migration boundary

Cohort/roster schema, historical pilot import, artifact-ownership mapping, and D-028 require product, privacy/security,
education, and migration approval. No personal project is reassigned or exposed automatically.

## Rollout

Synthetic tenant/cohorts → pilot-derived fixtures → one design-partner cohort → removal/portability verification → second
organization → bounded release after zero isolation drift.

## Rollback

Stop new cohort/assignment mutations, keep organization membership and audit intact, preserve authorized read/export,
and revert through compatible schema states. Never collapse cohort boundaries or convert personal work to institution data.

## Metrics and required artifacts

- Primary evidence: Cohort activation, assignment revision completion, educator decision usefulness, access denials, and support burden.
- Required artifacts: cohort/role matrix, D-028 contract, migration fixtures, cross-cohort tests, accessibility evidence,
  rollout log, rollback proof, and signed design-partner acceptance.
