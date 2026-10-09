# Data Export and Deletion Runbook

| Control | Value |
|---|---|
| Status | **DRAFT — DO NOT EXECUTE** |
| DRI | UNASSIGNED |
| Approver | UNASSIGNED — privacy/data owner required |
| Environment / target | UNSET |
| Required permissions | Scoped export/deletion worker; no ad hoc database or bucket deletion |
| Decision record | D-011/D-016 plus the authenticated user request and deletion approval |
| Last tested | NEVER |
| Next review | Before any staging drill or production request execution |

Export may proceed only after identity/scope approval. Before the first irreversible deletion step, stop and obtain the
repository-required explicit Turkish destructive confirmation for the resolved user, systems, and retention scope.

## Request state

`requested → identity_verified → scoped → processing → awaiting_dependency | completed | failed | cancelled`

Every transition records actor, reason, timestamp, policy/version, affected systems, and safe error code.

## Export

1. Verify identity and scope without exposing whether another account exists.
2. Collect documented profile, project, artifact, critique/chat/memory, public, billing-reference, and consent data.
3. Exclude secrets, other users, internal abuse signals, and protected third-party data.
4. Generate encrypted/short-lived delivery with access audit and expiry.
5. Reconcile expected versus exported record classes and mark completion.

## Deletion

1. Explain irreversible effects and separately identify legal/billing/backup retention.
2. Resolve the exact user, systems, records, retention exceptions, backup behavior, and dry-run inventory.
3. Stop and obtain explicit destructive confirmation for that resolved scope.
4. Immediately stop deleted memory/content from AI retrieval and stop new processing/public delivery.
5. Queue idempotent deletion/tombstone operations for primary data, files, caches, public derivatives, and analytics links.
6. Reconcile every system and report blocked/retained classes truthfully.
7. Complete only after the approved primary-system purge; retain a minimal request/audit record as policy allows.

## Failure and rollback

Pause destructive workers, preserve the request state and evidence, and resume idempotently after correction. Deletion of
already purged data cannot be rolled back; never claim otherwise. Backup expiry is communicated separately.
