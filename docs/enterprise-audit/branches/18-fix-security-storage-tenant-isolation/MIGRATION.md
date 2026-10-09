# Storage Isolation Migration

## Inventory manifest

For every existing object record: source bucket/object ID, checksum, size/MIME, owner, data class, privacy/public consent,
retention, referencing records, target bucket/path, copy state, and verification result. Do not infer public consent from
an existing public URL.

## Migration

1. Remove broad authenticated mutation from legacy buckets and require owner-validating server mediation.
2. Create private and public-derivative targets with least-privilege permissions.
3. Copy a synthetic/test cohort and verify checksum, metadata, owner, and access matrix.
4. Shadow-copy real objects in bounded batches without deleting sources.
5. Dual-read only through the server proxy, with expected-target comparison and alert on miss/mismatch.
6. Cut one user/data class to target reads and server-only writes.
7. Expand after two-user/anonymous and direct-object-ID tests and zero unexplained reconciliation drift.
8. Keep source objects inaccessible to clients through the approved retention/rollback window.

## Destructive boundary

Source deletion is not part of the first branch. It requires a separate inventory report, owner approval, retention check,
user/public-consent obligations, backup impact review, and verified target restore.

## Rollback

Route reads through the owner-validating server proxy backed by source mappings while retaining secure target copies and
audit state. Never restore direct client reads or broad authenticated mutation permissions to solve an application bug.
