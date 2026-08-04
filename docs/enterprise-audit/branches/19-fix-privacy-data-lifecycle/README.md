# fix/privacy-data-lifecycle

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 3 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-011 and D-016 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `fix/security-storage-tenant-isolation`, `refactor/versioned-appwrite-migrations` |
| Accountable roles | Privacy/security + product + data + legal advisor |

## Outcome

Make collection, provider transfer, retention, export, deletion, analytics consent, and public revocation truthful and executable.

## Evidence

The privacy page is thin and says data is not shared while AI artifacts/text/chat/memory reach gateway/providers; deleted memory can still affect prompts, hidden memory exists, cache purge is unclear, and cookie close behaves like accept.

## Scope

- Create a purpose/access/retention/provider/user-control inventory for every data class.
- Implement authenticated export/deletion orchestration with audit, durable tombstones/tasks, and completion receipts.
- Define the immediate AI retrieval-exclusion, hard-purge, and backup-expiry contract; the AI memory/cache branch owns
  retrieval enforcement, cache provenance, and purge workers.
- Separate analytics accept, reject, close, preference, and marketing consent accurately.
- Disclose AI processors, categories sent, advisory use, provider retention/training/region review, and public indexing.
- Handle data-subject request status, failure, identity proof, and completion evidence.

## Non-goals

No legal certification, AI retrieval/cache/purge implementation, or irreversible historical deletion without approved
policy and user warning.

## Acceptance criteria

- [ ] A deletion request emits a versioned downstream-deny/tombstone contract and cannot complete without required
  per-system receipts.
- [ ] Export covers the documented user data and preserves secure access/audit.
- [ ] Deletion orchestration is idempotent and reports partial/blocked downstream states truthfully.
- [ ] Cookie close does not imply accept and nonessential collection follows consent.
- [ ] Privacy copy matches observed network/provider/storage behavior.
- [ ] Backup/legal retention exceptions are explicit with expiry.
- [ ] DSR integration test proves request → verify → process → reconcile → complete.

## Approval and migration boundary

Retention periods, processor terms, irreversible deletion, minor/education data, and legal claims require owner plus qualified legal/privacy review.

## Rollout

Inventory and policy decision → consent/copy corrections → export → deletion orchestration/tombstones → downstream
handoff and reconciliation drills.

## Rollback

Pause orchestration and preserve request/tombstone state; never clear a deny contract or misstate downstream completion.

## Metrics and required artifacts

- Primary evidence: DSR completion/age, downstream receipt drift, consent accuracy, and processor-disclosure accuracy.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
