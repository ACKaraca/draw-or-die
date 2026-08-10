# fix/http-security-boundaries

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 2 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | None — branch approval only |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | M / Medium |
| Base | Protected `dev-main` |
| Depends on | `fix/staging-artifact-promotion` |
| Accountable roles | Security + platform + frontend + QA |

## Outcome

Enforce browser, origin, and mutation boundaries consistently across production and non-production.

## Evidence

`next.config.ts` lacks a complete security-header policy; Checkout/portal origin handling is permissive, and non-production indexing/analytics behavior is not isolated.

## Scope

- Implement strict production origin allowlists for Checkout, portal, callbacks, and state-changing routes.
- Introduce CSP in report-only mode, review violations, then enforce with nonces/hashes as required.
- Add HSTS in production, `nosniff`, referrer, permissions, and clickjacking controls.
- Document and test CSRF/trusted-origin strategy for cookie and bearer-token endpoints.
- Set secure cookie attributes where applicable.

## Non-goals

No identity-provider replacement or broad frontend styling change.

## Acceptance criteria

- [ ] Unlisted origins cannot create Checkout/portal/mutation responses.
- [ ] Production header integration tests pass; development behavior remains usable without weakening production.
- [ ] CSP report-only violations are triaged before enforcement and required app/Stripe/Appwrite flows work.
- [ ] HSTS is production-only and configured for the approved domain scope.
- [ ] Clickjacking and MIME-sniffing tests fail safely.
- [ ] No wildcard CORS or client-controlled return origin remains.

## Approval and migration boundary

CSP and HSTS scope require owner/security approval because incorrect rollout can break production or affect subdomains.

## Rollout

Staging report-only CSP → production report-only → small enforced cohort/environment → full enforcement after clean reports.

## Rollback

Return CSP to report-only or disable a narrow directive; retain origin allowlists and other safe headers.

## Metrics and required artifacts

- Primary evidence: Blocked untrusted-origin tests 100%; unresolved CSP violations and security-header scanner score.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
