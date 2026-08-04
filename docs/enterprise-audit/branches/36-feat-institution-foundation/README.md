# feat/institution-foundation

| Field | Value |
|---|---|
| Priority / phase | P3 / Phase 8 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-019, D-027, D-028, and D-030 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `docs/education-pilot-evidence`, `refactor/versioned-appwrite-migrations`, `fix/security-storage-tenant-isolation`, `fix/privacy-data-lifecycle`, `chore/critical-contract-harness`, `docs/incident-dr-release-runbooks`; plus an approved D-027 invest decision |
| Accountable roles | Product + institution identity/platform + security/privacy + education + QA |

## Outcome

Add the minimum organization tenancy, membership, role, and audit foundation proven necessary by paid pilots. Cohort,
billing, reporting, and recovery remain separate rollback branches.

## Evidence

Education may be valuable, but current demand and requirements are hypotheses. The earlier monolithic plan combined
tenancy, cohort workflows, billing, reporting, and recovery in one XXL branch, violating the portfolio's one-rollback-
boundary rule and increasing student-data risk.

## Scope

- Implement organization tenancy and server-owned organization membership.
- Define least-privilege `organization_owner`, `organization_admin`, `billing_admin`, `educator`, `learner`, and
  time-bounded `support` roles under D-030.
- Separate membership administration, billing authority, educator access, learner access, and support elevation.
- Add verified invitation, acceptance, role change, organization transfer, suspension, removal, and deprovision flows.
- Enforce tenant-scoped API, storage, analytics, export, audit, and support authorization before downstream features.
- Record immutable actor, tenant, role/permission snapshot, purpose, target, result, and correlation evidence.
- Preserve personal projects and AI memory outside the institution unless explicitly assigned under D-028.
- Provide schema extension points for cohort, billing, reporting, and recovery branches without implementing them here.

## Non-goals

No cohort/roster workflow, institution billing/Rapido, educator reporting, backup/offboarding orchestration, Friends
Team-to-school conversion, broad LMS replacement, surveillance, automatic grading, marketplace, or SSO.

## Acceptance criteria

- [ ] Cross-organization access/mutation is zero across API, storage, analytics, exports, and support tooling.
- [ ] Exactly one active organization owner exists; owner transfer and deletion cannot orphan a tenant.
- [ ] Organization admin and billing admin are separable; neither inherits educator, learner, or support access implicitly.
- [ ] Support access is approved, purpose-bound, time-limited, visible, revocable, and fully audited.
- [ ] Invite, accept, role change, suspend, remove, owner transfer, and deprovision transitions are atomic and replay-safe.
- [ ] Personal projects, personal Rapido, Friends Team data/value, and AI memory remain outside institution authority by default.
- [ ] Downstream cohort, billing, reporting, and recovery modules cannot bypass the central tenant/RBAC policy.
- [ ] Two-organization production-path authorization tests pass for every role, state, file, export, and support action.
- [ ] AI cannot auto-grade, discipline, or make admissions decisions.

## Approval and migration boundary

This branch cannot start without the approved D-027 pilot-evidence investment gate and explicit product, security,
privacy/legal, education, migration, and independent-review approval. It cannot grant institution billing or learner-
artifact access beyond D-028.

## Rollout

Synthetic organizations → role/tenant fault matrix → one design-partner organization → independent isolation review →
second organization. General availability remains blocked on cohort, billing, reporting, and recovery branch gates.

## Rollback

Stop new organizations, invitations, and role mutations; preserve tenant isolation, authorized read/export, audit, and
paid obligations; revert through compatible commits without merging tenants or broadening support access.

## Metrics and required artifacts

- Primary evidence: Tenant/role isolation violations, ownerless organizations, unauthorized support access, and replay drift are zero.
- Required PR artifacts: RBAC/ownership matrix, migration plan, two-organization production-path tests, support-access
  audit proof, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
