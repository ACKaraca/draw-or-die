# Education Pilot Cohort Operations Runbook

> **DRAFT — NOT EXECUTABLE.** Owners, D-031, the signed pilot/DPA, environment controls, ledger migration, and rollback
> evidence must be approved before this runbook can enroll a learner or grant institutional Rapido.

## Preconditions

- Named education-operations, privacy/security, finance, support, and incident owners.
- Signed scope, DPA/provider list, cohort dates, learner cap, included allowance, support boundary, and termination terms.
- Dedicated pilot environment/namespace, keys, storage scope, analytics destination, backup, and restore target.
- Approved roster manifest, educator authority, learner notice/consent basis, and D-028 artifact-access policy.
- Green migration, isolation, concurrency, export/delete, restore, alert, and rollback evidence.

## Provisioning record

Record without secrets:

| Field | Required value |
|---|---|
| Pilot and cohort IDs | UNSET |
| School and budget holder | UNSET |
| Environment/namespace ID | UNSET |
| Contract/invoice reference | UNSET |
| Start/end/closeout dates | UNSET |
| Roster/educator manifest digest | UNSET |
| Included Rapido and expiry | UNSET |
| Overage state and cap | Disabled / 0 by default |
| Backup/restore evidence | UNSET |
| Incident/support contacts | UNSET |

## Setup

1. Verify the environment/namespace is empty and cannot enumerate another pilot.
2. Apply versioned migrations and capture checksum/result evidence.
3. Create the cohort account and ledger account using server-owned identifiers.
4. Import the approved roster/educator manifest; reject duplicates, unverified identities, and role conflicts.
5. Post the contract-backed allowance grant once and reconcile the projection to the journal.
6. Keep overage disabled; test a denied operation beyond the allowance.
7. Run two-pilot isolation, removed-member, signed-access, export/delete, restore, and alert checks.
8. Obtain enrollment approval and record the evidence links.

## Daily operation

- Reconcile grant, reserve, settle, void, expiry, adjustment, and projection totals.
- Review wrong-wallet, cross-pilot denial, failed operation, support adjustment, and allowance-threshold alerts.
- Confirm roster/educator changes have an approved source and immediate access revocation.
- Preserve learner/educator notices, access logs, incident evidence, and support decisions.
- Never expose provider cost, internal margin, or conversion data to the cohort product surface.

## Incident and stop conditions

Stop new enrollment and institutional reservations for the affected pilot on any cross-pilot access, wrong-wallet charge,
negative/duplicate value, missing audit record, uncontrolled overage, failed restore, or unresolved P1 privacy/security
incident. Preserve evidence, reconcile in-flight reservations, notify the named incident owner, and follow the approved
contract/incident communications plan.

## Closeout

1. Stop new grants and reservations at the contracted end time.
2. Reconcile all in-flight and completed operations; document unused allowance treatment and approved refunds/credits.
3. Export or return learner/institution artifacts under D-028 and the signed contract.
4. Revoke roster, educator, support, signed-link, and key access.
5. Execute retention/delete policy and an isolated restore-verification sample.
6. Freeze the redacted evidence pack for `docs/education-pilot-evidence`.
7. Do not copy data, value, roles, or pricing into Friends Team or another pilot.
