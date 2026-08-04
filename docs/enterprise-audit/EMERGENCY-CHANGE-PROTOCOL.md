# Emergency Change and Migration Protocol

## Purpose

P0 containment must not wait for the full migration platform, but an emergency is not permission for untracked schema
changes or request-time admin DDL. This protocol applies to urgent additive state needed for consent, OTP secrecy,
identity/reward uniqueness, kill switches, and incident evidence before Phase 2 migrations are available.

## Allowed emergency changes

- Additive collection/table, field, index, uniqueness record, or restrictive permission.
- Server-only record needed to close an active vulnerability.
- A restrictive feature flag or access-control change.
- No drop, rename, destructive backfill, broad permission, or data deletion.

## Required record

1. A checked-in, immutable, checksummed change file with an ordered emergency ID.
2. Exact environment/project/resource targets resolved through read-only preflight.
3. Explicit owner and security/data approver.
4. Dry-run output, backup/restore assessment, idempotency and concurrent-run behavior.
5. Forward-fix and safe-disable path.
6. Execution actor, timestamp, release SHA, result, and post-change verification.
7. Import into the Phase 2 migration baseline without editing the emergency record.

## Prohibited behavior

- Running schema/bootstrap creation from a customer request.
- Accepting legacy plaintext verification material during transition.
- Deleting historical gallery, wallet, OTP, storage, or user data.
- Editing an already applied emergency change.
- Widening permissions as a rollback.

## Approval checkpoint

The change must remain `DRAFT — DO NOT EXECUTE` until DRI, approver, target, dry-run, rollback, and verification evidence
are filled. Any irreversible action leaves this protocol and requires the repository's explicit Turkish destructive
confirmation immediately before execution.
