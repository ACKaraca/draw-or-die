# fix/revision-continuity

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 5 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-014 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | L / High |
| Base | Protected `dev-main` |
| Depends on | `fix/security-storage-tenant-isolation`, `feat/product-funnel-instrumentation`, `chore/critical-contract-harness` |
| Accountable roles | Product + project/history engineering + QA |

## Outcome

Let a user reopen a saved project and continue a same-project revision with source, context, ownership, and billing continuity.

## Evidence

History reopen clears `previousProject` and does not restore source payload; revision actions disappear, filtering only applies to a loaded subset, and save/preservation billing is inconsistent.

## Scope

- Create or use durable project/artifact lineage for saved analyses.
- Restore authorized source/reference/context and previous project on reopen.
- Handle legacy records without source gracefully and explain unavailable actions.
- Make server-side pagination/filter states accurate and recoverable.
- Define basic save/resume versus paid retention/export with approved entitlement policy.
- Ensure reopen/retry/revision uses one operation and ledger contract.

## Non-goals

No full issue-resolution comparison or Portfolio editor redesign.

## Acceptance criteria

- [ ] Save → close/session refresh → reopen → revise works end to end with the correct source owner.
- [ ] Legacy missing-source items display a truthful recovery path rather than a false empty action.
- [ ] User A cannot reopen/revise User B data.
- [ ] Revision continuation does not double charge or create duplicate history.
- [ ] Server pagination/filter never shows false-empty from only the first 12 records.
- [ ] Delete/archive has confirmation, authorized state, and approved undo/retention behavior.
- [ ] Revision-start/completion events retain the same project lineage.
- [ ] The production-path save→reopen→revise contract remains a required compatibility test for later state refactors.

## Approval and migration boundary

History retention/pricing, storage migration, and deletion semantics require product/privacy/commerce approval.

## Rollout

Add lineage to new saves → backfill safe references → shadow reopen verification → small cohort → make revision CTA primary for eligible history.

## Rollback

Disable revision-from-history while preserving read-only history and newly written lineage; do not delete references.

## Metrics and required artifacts

- Primary evidence: Save→reopen success, result→revision rate, lineage mismatch and duplicate charge zero.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
