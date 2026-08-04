# fix/ai-memory-cache-semantics

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 4 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-011 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | L–XL / High |
| Base | Protected `dev-main` |
| Depends on | `fix/privacy-data-lifecycle`, `refactor/ai-operation-registry`, `refactor/versioned-appwrite-migrations` |
| Accountable roles | AI/data + privacy/security + QA |

## Outcome

Enforce the approved privacy deletion/retention contract in the AI data plane and prevent incompatible historical
context from influencing a new operation.

## Evidence

Deleted memory is loaded for 30 days, a hidden style inference cannot be user-deleted, no purge is demonstrated, and a file-hash cache can drop the real image while ignoring operation/model/prompt/schema versions.

## Scope

- Consume the privacy branch's versioned deny/tombstone contract, exclude deleted memory immediately, and implement
  scheduled hard purge/reconciliation with completion receipts.
- Remove hidden memory or make every inference visible, opt-in, editable, exportable, and deletable.
- Replace analysis-summary substitution with a versioned visual-evidence extraction cache.
- Key cache by owner/file hash/preprocessor/extraction model/schema and record page/source/confidence.
- Invalidate incompatible versions and require source images for bbox/spatial operations.
- Cascade project/account deletion to memory/cache according to approved retention.

## Non-goals

No blanket retention extension or hidden personalization experiment.

## Acceptance criteria

- [ ] A delete followed immediately by a new request includes zero deleted snippet.
- [ ] Privacy deletion/tombstone retries are idempotent and return an auditable exclusion/purge receipt.
- [ ] Cross-operation, cross-model, cross-prompt/schema, and cross-user cache contamination tests pass.
- [ ] Premium Rescue receives the correct source page/image even on cache hit.
- [ ] Model/preprocessor/schema upgrade cannot reuse incompatible evidence.
- [ ] User can inspect/control every persisted memory category.
- [ ] Purge/reconciliation reports zero unexplained orphan beyond approved backup retention.
- [ ] Cache provenance is visible without logging raw content.

## Approval and migration boundary

Policy, retention, hidden-inference behavior, and purge authority remain owned by the privacy lifecycle contract. This
branch implements the AI retrieval/cache/purge side. Irreversible purge must follow the approved deletion state machine.

## Rollout

Immediate retrieval exclusion → cache read shadow validation → new versioned writes → disable summary substitution → purge/reconciliation.

## Rollback

Disable memory/cache retrieval and send the source artifact; never restore deleted memory or incompatible summary substitution.

## Metrics and required artifacts

- Primary evidence: Deleted-memory inclusion and cache contamination zero; hit quality, invalidation, purge/orphan counts.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
