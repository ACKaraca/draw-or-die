# fix/historical-gallery-remediation

| Field | Value |
|---|---|
| Priority / phase | P0 closure / Phase 1 decision-gated |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED — required roles: product owner + privacy/security owner |
| Target | UNSET — assign after read-only inventory and D-004 |
| Decision gates | D-004 and explicit destructive confirmation for archive/delete targets |
| Blocked until | `fix/explicit-gallery-consent` is live and the inventory is independently reviewed |
| Effort / delivery risk | M–L / High |
| Base | Protected `dev-main` |
| Depends on | `fix/explicit-gallery-consent`, D-004 |
| Accountable roles | Product/privacy + gallery/data + support/communications + QA |

## Outcome

Remove unauthorized historical exposure through an owner-approved, auditable, minimally destructive remediation.

## Evidence

The analysis hook/API path could create auto-approved public gallery records without explicit consent. The number and
identity of affected production records were not available to the audit.

## Scope

- Reproduce and independently review the read-only affected-record inventory and confidence rules.
- Choose reversible unlist/quarantine, owner contact/re-consent, archive, or deletion by documented class.
- Remove public/CDN/search delivery immediately for records classified as unauthorized when approved.
- Preserve the minimum incident/audit evidence and process owner export/delete requests.
- Reconcile database, storage, public URL, cache/CDN, sitemap, and search-removal state.

## Non-goals

No automatic mass deletion, ownership inference, balance/reward change, or re-publication from historical AI placement.

## Acceptance criteria

- [ ] Every target record is linked to inventory evidence, decision class, approver, and operation result.
- [ ] Records without provable publish consent are not publicly delivered after approved remediation.
- [ ] Archive/delete operations are idempotent, bounded, dry-run first, and independently reconciled.
- [ ] Owner export/re-consent/revocation and support communication follow the approved policy.
- [ ] CDN/search/storage/database state reaches the same intended result with zero unrelated records changed.
- [ ] R-003 remains open until this evidence and the new-consent invariant both pass.

## Approval and migration boundary

Before any archive or deletion, state the exact target/count and consequence in one Turkish sentence and wait for the
owner's explicit `evet`, `tamam`, or equivalent approval. Permanent deletion requires an additional final checkpoint;
unlisting is the default containment when the correct destructive action is uncertain.

## Rollout

Dry-run → small reviewed cohort → reconcile → owner checkpoint → bounded batches with stop conditions and customer
support monitoring.

## Rollback

Reversible unlisting/quarantine can be restored only with consent evidence and owner approval. Permanent deletion cannot
be rolled back and must never be described as recoverable.

## Metrics and required artifacts

- Primary evidence: unauthorized historical public delivery zero; unrelated mutation zero; remediation reconciliation.
- Required artifacts: signed inventory, D-004, Turkish approval record, dry run, batch log, communication and final report.
