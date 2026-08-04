# feat/education-pilot-cohort-controls

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 7 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED — required roles: product/education + security/privacy + finance + operations |
| Target | UNSET — assign before any learner enrollment or institutional allowance grant |
| Decision gates | D-019, D-026, D-027, D-028, and D-031 |
| Blocked until | Pilot protocol, listed dependencies, owners, contracts, and isolated-boundary drill are approved |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `docs/education-studio-pilot`, `refactor/versioned-appwrite-migrations`, `fix/atomic-rapido-ledger`, `fix/security-storage-tenant-isolation`, `fix/privacy-data-lifecycle`, `chore/critical-contract-harness`, `docs/incident-dr-release-runbooks`, `feat/operational-observability` |
| Accountable roles | Education operations + ledger/commerce + identity/storage + privacy/security + QA |

## Outcome

Provide the minimum isolated, auditable cohort and institutional Rapido controls required to operate each paid
Education Studio pilot without prematurely building a reusable institution platform.

## Evidence

The pilot contract requires institution-owned cohort Rapido, bounded learner access, export/delete, and restore proof.
Friends Team explicitly excludes school funding, while the full institution wallet and role system is gated until after
successful pilots. Without this branch, the pilot has no authoritative allowance account or second-pilot isolation path.

## Scope

- Provision a separate approved environment or hard namespace for each pilot; never place two schools in an unproven
  shared tenant boundary.
- Create one pilot/cohort identity, roster allowlist, named budget holder, named educators, and learner memberships from
  a signed enrollment manifest.
- Create a cohort-owned ledger account distinct from personal and Friends Team wallets.
- Permit only approved server-side grants backed by the signed pilot contract; no self-serve Stripe school Checkout.
- Enforce included allowance, learner/cohort cap, allowance-first consumption, expiry/closeout, and overage-off-by-default.
- Authorize every analysis using current pilot, cohort, roster, project, operation, and institutional budget context.
- Apply D-028 to educator access: assignment-scoped visibility, clear notice/lawful authority, immutable access logs, and
  learner portability after the pilot.
- Prove cross-pilot API/storage/export/analytics separation, removed-learner revocation, backup/restore, and closeout.
- Record invoice/contract reference, funding source, grants, reservations, settlement/void, support adjustments, and
  reconciliation without exposing internal provider cost or margin to learners/educators.
- Use the colocated [pilot operations runbook](./RUNBOOK.md) for setup, daily checks, incident response, and termination.

## Non-goals

No reusable organization hierarchy, consumer Friends Team reuse, public collaboration, SSO, self-serve institution
billing, multi-school shared tenancy, automatic grading, unlimited allowance, or platform-wide educator reporting.

## Acceptance criteria

- [ ] Every pilot has a unique environment/namespace, cohort ID, data boundary, storage scope, ledger account, and key set.
- [ ] Cross-pilot read/write/list/export/analytics access is zero across two synthetic pilots before the second enrollment.
- [ ] Cohort allowance cannot move to a learner, personal account, Friends Team, cash value, referral, promo, or earned wallet.
- [ ] Reserve → settle/void is atomic and idempotent; concurrent learners cannot overspend or charge another funding source.
- [ ] Overage remains disabled unless a signed contract amendment and budget-holder approval activate a bounded limit.
- [ ] Removed learners and educators immediately lose new and cached/signed access without deleting the audit trail.
- [ ] Educator artifact access follows D-028, is logged, and is removed or exported according to pilot closeout terms.
- [ ] Isolated export/delete and restore drills pass for each pilot before learner data is accepted.
- [ ] Funding, usage, invoice, support adjustment, and closeout reconcile to zero unexplained value drift.
- [ ] The approved runbook passes a tabletop covering incident, school withdrawal, exhausted allowance, and pilot closure.

## Approval and migration boundary

No learner may be enrolled and no institutional value may be granted until D-031, the signed pilot/DPA, environment and
ledger migrations, role/access matrix, funding authority, runbook, and rollback are approved. Any cross-pilot shared
infrastructure requires a separate institution-tenancy decision after pilot evidence.

## Rollout

Synthetic pilot A → isolated restore and fault tests → synthetic pilot B cross-boundary matrix → one paid pilot →
reconciliation/closeout review → second paid pilot in a separate boundary.

## Rollback

Stop enrollment and new institutional reservations, preserve the immutable ledger/audit record, reconcile in-flight
operations, honor contracted export/delete/support, and close only the affected pilot boundary. Never merge its data or
remaining value into another pilot, Friends Team, or personal account.

## Metrics and required artifacts

- Primary evidence: Cross-pilot violations, wrong-wallet charges, negative balances, duplicate grants, and unexplained drift are zero.
- Required artifacts: environment/namespace register, role matrix, signed funding fixture, two-pilot isolation tests,
  ledger reconciliation, restore proof, runbook tabletop, enrollment approval, and closeout report.
