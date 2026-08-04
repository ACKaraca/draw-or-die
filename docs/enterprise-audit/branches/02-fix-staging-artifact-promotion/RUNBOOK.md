# Artifact Promotion and Rollback Runbook

| Control | Value |
|---|---|
| Status | **DRAFT — DO NOT EXECUTE** |
| DRI | UNASSIGNED |
| Approver | UNASSIGNED — production environment owner required |
| Environment / target | UNSET |
| Required permissions | Least-privilege deploy and protected-environment approval; no shared credentials |
| Decision record | D-003 plus the linked release approval |
| Last tested | NEVER |
| Next review | Before any staging or production execution |

Execution is prohibited until every control above is resolved, the exact artifact/digest is recorded, and the rollback
target has been verified read-only.

## Preconditions

- The authoritative deployment platform is recorded in the decision log.
- `main` and `dev-main` protections are active.
- The artifact contains commit SHA, build timestamp, runtime, lockfile hash, and digest.
- Staging uses isolated Appwrite, Stripe test mode, analytics, secrets, domain, and `noindex`.
- Database/schema compatibility is green for both current and candidate releases.

## Promotion

1. Build once from the approved commit in the pinned runtime.
2. Sign/record artifact digest and retain build/test/SBOM evidence.
3. Deploy that digest to staging without rebuilding.
4. Verify release/readiness endpoints report the expected SHA/digest.
5. Run critical E2E, synthetic payments, provider canary, permission, and migration compatibility.
6. Stop and obtain recorded protected production-environment approval from `refs/heads/main`.
7. Promote the same digest and activate a bounded canary.
8. Compare error, latency, money drift, AI, and core-journey guardrails.
9. Expand exposure or roll back; record the decision.

## Rollback trigger

- release/readiness mismatch;
- P0 correctness/security/privacy invariant;
- critical-journey synthetic failure;
- unexplained wallet/Stripe/entitlement/storage drift;
- migration incompatibility;
- error-budget burn above the approved canary threshold.

## Rollback

1. Stop exposure through the server kill switch or traffic control.
2. Reactivate the previous verified deployment ID/digest.
3. Confirm readiness, core journeys, and release identity.
4. Pause/reconcile queued financial or data effects; do not delete source events.
5. Open an incident record and customer remediation assessment.
6. Fix forward through a new PR/commit; never rebuild or force-push the rollback.
