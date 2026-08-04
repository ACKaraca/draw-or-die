# Versioned Appwrite Migration Design

## Migration record

Each immutable migration records:

- ordered ID and human title;
- checksum and runner version;
- required previous schema version;
- expand/backfill/verify/contract phase;
- started/completed timestamp, lease owner, attempt, status, and error code;
- dry-run/preflight output and release compatibility range;
- evidence link and approver.

Applied migration files are never edited. Corrections use a new forward migration.

## Initial adoption

1. Inventory actual production resources/permissions through a read-only export.
2. Define the current state as a checksummed baseline without mutating it.
3. Deploy migration ledger and lock with no-op runner.
4. Prove concurrent-runner exclusion and interrupted-run recovery in staging.
5. Add one low-risk additive migration and test empty/existing fixtures.
6. Move one route family off request-time bootstrap.
7. Continue until request-path admin DDL count is zero.

## Expand/backfill/contract

- Expand adds optional resources/fields/permissions compatible with the current release.
- Backfill is resumable, rate-limited, checksummed, and separately observable.
- Verify reconciles counts, ownership, schema, permissions, and sampled content.
- Contract happens only in a later release after all readers/writers have moved and owner approval exists.

## Recovery

Stop the runner, retain the ledger/lease/error, keep the application on a backward-compatible path, restore only into an
isolated environment for verification, and fix forward. Never drop data or rewrite the ledger as a rollback.

