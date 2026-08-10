# feat/operational-observability

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 2 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-015 and D-017 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | L / Medium |
| Base | Protected `dev-main` |
| Depends on | `fix/staging-artifact-promotion` |
| Accountable roles | SRE/platform + commerce + AI + privacy |

## Outcome

Make releases, failures, cost, and customer-value drift detectable before financial and AI migrations roll out.

## Evidence

Health always reports `ok`, deep health is not monitor-friendly, logs are stdout-only, request IDs are inconsistent,
SLO/alert/reconciliation controls are absent, and billing summaries mix currencies/grants.

## Scope

- Add release SHA/digest, schema/model policy version, liveness, readiness, and authenticated diagnostics.
- Propagate correlation/request/event/operation IDs across routes, Stripe, AI, wallet, and storage.
- Emit structured redacted logs and dependency spans without raw prompts/files/email/credential fingerprints.
- Create minimum Stripe/wallet/entitlement drift, AI cost/failure, and unauthorized-publication metrics.
- Keep TRY/USD and purchase/grant dimensions separate.
- Create machine-readable reconciliation queries, scheduled internal reports, actionable alerts, ownership, retention,
  and synthetic incident tests without adding a dashboard product surface.

## Non-goals

No indiscriminate raw event logging, session replay of private artifacts, or vendor lock-in without review.

## Acceptance criteria

- [ ] Every critical request and Stripe event is traceable to release and outcome.
- [ ] No raw prompt, base64, email, artifact URL, chat, or secret fragment appears in log scans.
- [ ] Synthetic wallet/Stripe drift and release-health failure trigger the expected alert/runbook.
- [ ] Reconciliation reports separate currency, wallet type, provider/model, and environment.
- [ ] Telemetry failure does not leak data or silently authorize risky behavior.
- [ ] Baseline SLI queries and freshness/completeness indicators are documented.

## Approval and migration boundary

Telemetry fields, vendor, retention, and destinations require privacy/security approval. Financial metrics require commerce validation.

## Rollout

Start with release/IDs and redaction tests, add financial/AI signals in staging, validate synthetic alerts, then use the controls as prerequisites for ledger rollout.

## Rollback

Disable a noisy exporter or field at the server allowlist while keeping release identity and critical audit events.

## Metrics and required artifacts

- Primary evidence: Trace completeness, log redaction violations zero, alert detection time, reconciliation freshness.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
