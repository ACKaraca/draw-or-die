# fix/security-storage-tenant-isolation

| Field | Value |
|---|---|
| Priority / phase | P0 / Phase 3 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | None — branch and per-migration approval only |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `fix/explicit-gallery-consent`, `refactor/versioned-appwrite-migrations`, `chore/critical-contract-harness` |
| Accountable roles | Security + storage/data + product/privacy + QA |

## Outcome

Separate public and private artifacts and prove owner/tenant isolation for every read, write, update, and delete.

## Evidence

Shared Appwrite buckets use broad authenticated update/delete permissions and `fileSecurity: false`; history/mentor/public assets do not have an auditable least-privilege separation.

## Scope

- Inventory every bucket/file class, purpose, owner, access path, retention, and public contract.
- Lock broad authenticated mutation on legacy buckets as the first independently deployable containment step.
- Separate public gallery from private project/history/mentor/eval content.
- Use server-only mutation and owner-scoped read or short-lived signed proxy access.
- Validate MIME, magic bytes, parser limits, dimensions/pages, checksum, quarantine, and active-content disposition.
- Migrate with copy/checksum/dual-read and explicit ownership mapping.
- Add two-user/anonymous cross-tenant integration tests and deletion cascade behavior.

## Non-goals

No source-file deletion, public-content growth, or storage-provider migration in the first cutover.

## Acceptance criteria

- [ ] User A cannot read/update/delete User B private content; anonymous cannot access it.
- [ ] Direct access to every known legacy object ID is denied unless an authorized server proxy validates ownership or consent.
- [ ] Authenticated users cannot mutate another user's public submission.
- [ ] Public URLs expose only explicitly approved public derivatives.
- [ ] Copied objects match checksum/metadata/owner before read cutover.
- [ ] Real production upload handler rejects invalid signature, dangerous active content, and resource-limit corpus.
- [ ] Dual-read produces zero unexplained misses before authority cutover.
- [ ] Original objects remain until a separately approved retention/removal step.

## Approval and migration boundary

Bucket permission changes, copies, retention, and source deletion require explicit owner/security approval. Removal is a later destructive action.

## Rollout

Inventory → lock broad legacy mutation → create private/public targets → shadow copy/checksum → server-mediated dual-read
→ small owner cohort → authority cutover → retention window.

## Rollback

Route reads through an owner-validating server proxy backed by the retained source objects while keeping secure new
copies and audit mapping. Never restore direct client access or broaden permissions as rollback.

## Metrics and required artifacts

- Primary evidence: Cross-tenant access/mutation zero; copy checksum mismatch zero; orphan and dual-read miss count.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
