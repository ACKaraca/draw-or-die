# refactor/versioned-appwrite-migrations

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 2 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | None — branch and per-migration approval only |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `fix/staging-artifact-promotion` |
| Accountable roles | Platform/data engineering + security + QA |

## Outcome

Move Appwrite schema/resource mutation out of customer requests into versioned, checksummed, recoverable migrations.

## Evidence

`lib/appwrite/resource-bootstrap.ts` creates many collections/buckets with admin credentials at runtime, has process-local TTL, can race, and can skip resource-limit failures without a migration ledger.

## Scope

- Define immutable ordered migrations with checksum, lock, status, runner version, and audit ledger.
- Support preflight, dry-run, idempotent retry, resumable backfill, and schema compatibility checks.
- Adopt expand → backfill → verify → contract across releases.
- Test empty and representative existing databases and resource permission outcomes.
- Remove admin DDL/resource creation from request paths after compatibility rollout.
- Document backup, restore, forward-fix, and failure recovery.

## Non-goals

No destructive table drop, product data redesign, or wallet/storage cutover in the first migration branch.

## Acceptance criteria

- [ ] Two concurrent runners apply each migration at most once.
- [ ] Interrupted migration resumes or fails safely with visible state.
- [ ] Checksums detect edited historical migrations.
- [ ] Empty and existing database fixtures reach the same expected schema/permissions.
- [ ] Old and new application versions work during the expand window.
- [ ] No customer route performs admin schema mutation.
- [ ] Restore and forward-fix drill passes before production.

## Approval and migration boundary

Every production schema/permission change needs explicit owner approval. Destructive contract steps must be separate later branches and releases.

## Rollout

Deploy runner and ledger first, import current schema as baseline, run no-op/dry-run in staging/production, then migrate one low-risk resource.

## Rollback

Stop the runner and deploy a backward-compatible app; use forward-fix. Never edit applied migration history or drop data to roll back.

## Metrics and required artifacts

- Primary evidence: Schema drift zero; migration failure/lock age; request-path DDL count zero.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
