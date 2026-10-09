# feat/institution-recovery-offboarding

| Field | Value |
|---|---|
| Priority / phase | P2 / Phase 8 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED — required roles: platform/SRE + security/privacy + finance/support |
| Target | UNSET — required before institution general availability |
| Decision gates | D-016, D-018, D-027, and D-032 |
| Blocked until | Institution tenancy, cohort, billing, reporting data classes, owners, and recovery objectives are approved |
| Effort / delivery risk | L–XL / High |
| Base | Protected `dev-main` |
| Depends on | `feat/institution-foundation`, `feat/institution-cohort-roster`, `feat/institution-billing-rapido`, `feat/institution-educator-reporting`, `docs/incident-dr-release-runbooks` |
| Accountable roles | Platform/SRE + institution data + security/privacy + finance/support + QA |

## Outcome

Prove tenant-scoped backup, restore, export, deletion, contract termination, and offboarding across the complete
institution product before broader availability.

## Evidence

Tenancy, cohort, billing, Rapido, files, audit, and derived reports have different recovery and retention semantics.
Bundling recovery into each feature leaves no end-to-end proof that one organization can be restored or removed without
affecting another or corrupting financial evidence.

## Scope

- Inventory every institution data class, owner, authority, retention, backup, replay source, and legal/contract exception.
- Implement tenant-scoped export, deletion orchestration, key/access revocation, signed-link invalidation, and support handoff.
- Restore one organization into an isolated target and verify identity, roles, cohorts, artifacts, ledger, entitlements,
  reports, audit, checksums, and cross-tenant denial.
- Define contract termination, unpaid balance/refund/credit, remaining allowance, immutable financial records, and learner portability.
- Exercise regional/provider outage, partial restore, corrupted backup, deleted identity, owner departure, and support-access expiry.
- Measure and approve actual RPO/RTO against D-018 before institution general availability.

## Non-goals

No new product workflow, pricing, reporting field, cross-tenant restore, destructive production drill without approval,
or deletion of legally required financial/security evidence.

## Acceptance criteria

- [ ] A complete organization restores into isolation within approved RPO/RTO with checksums and zero other-tenant mutation.
- [ ] Export includes all contractually portable data and excludes secrets, other tenants, internal provider cost, and unrelated events.
- [ ] Delete/offboard revokes active, cached, signed, support, API, and billing access in the approved order.
- [ ] Financial/audit records retained by law or contract are minimized, access-controlled, and disconnected from product access.
- [ ] Owner departure, organization transfer, contract termination, refund/credit, and remaining allowance have tested outcomes.
- [ ] A failed or partial restore is detected, contained, and safely retried without duplicate ledger/entitlement effects.
- [ ] Two-tenant restore/offboarding and incident tabletop evidence receives independent security/privacy/finance review.

## Approval and migration boundary

RPO/RTO, backup scope, export schema, retention, deletion order, contract termination, financial-record exceptions, and
production drills require owner plus platform, security/privacy, finance, and legal approval. Destructive drills require
the explicit confirmation mandated by repository policy.

## Rollout

Synthetic tenant → isolated restore → two-tenant denial matrix → design-partner export/offboarding tabletop → scheduled
non-destructive production drill → general-availability gate.

## Rollback

Stop new offboarding/deletion automation, preserve immutable requests/evidence, restore normal access only with approved
identity/contract authority, and use the last verified manual runbook. Never merge tenant data during recovery.

## Metrics and required artifacts

- Primary evidence: Restore success/RPO/RTO, export completeness, deletion SLA, cross-tenant mutation, and support/finance exceptions.
- Required artifacts: data inventory, restore/export/delete contracts, checksum manifest, two-tenant tests, tabletop and
  drill reports, exception register, rollout log, rollback proof, and independent approvals.
