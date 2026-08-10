# chore/security-runtime-dependencies

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 2 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | None — branch approval only |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | M–L / Medium |
| Base | Protected `dev-main` |
| Depends on | `fix/release-build-blockers`, `chore/critical-contract-harness` |
| Accountable roles | Platform + security + QA |

## Outcome

Remove or explicitly contain production dependency risk under one reproducible runtime policy.

## Evidence

`npm audit --omit=dev` reports 9 high and 6 moderate production findings, including direct/reachable paths through Next, PostCSS, Sharp, and transitive Hono. Audits are intentionally non-blocking.

## Scope

- Classify reachability and fixed versions for each production finding.
- Patch compatible direct dependencies first; isolate risky major upgrades such as Sharp.
- Pin one supported runtime/toolchain and exact critical peer versions.
- Generate SBOM/provenance and enforce a time-bounded exception register.
- Pin GitHub Actions to reviewed commit SHAs and block policy-level findings.
- Remove dependencies only after source, bundle, and runtime evidence proves they are unused.

## Non-goals

No blind `npm audit fix --force`, framework major upgrade, or unrelated package cleanup.

## Acceptance criteria

- [ ] Production critical/high findings are zero or have an owner, reachability analysis, expiry, and compensating control.
- [ ] Every exception also records the affected package/advisory, security approver, immutable evidence reference, and
  an expiry after which the merge/release gate fails closed.
- [ ] Two clean installs/builds on the supported runtime pass without engine or peer mismatch.
- [ ] Unit, integration, E2E smoke, PDF/image, and bundle checks pass.
- [ ] SBOM and audit report are retained with the release artifact.
- [ ] A seeded policy-level finding blocks the merge gate.
- [ ] Action dependencies are pinned and reviewed.

## Approval and migration boundary

Major-version upgrades and vulnerability exceptions require explicit engineering/security approval. A vulnerability
exception cannot replace branch approval or authorize work to start; it is time-bounded merge/closure evidence only.
Do not downgrade security controls to retain compatibility.

## Rollout

Land compatible patches in small groups, canary image/PDF and production framework changes, then enable the blocking policy.

## Rollback

Return to the last non-vulnerable supported version or disable the affected surface; do not roll back to a known exploitable version silently.

## Metrics and required artifacts

- Primary evidence: Open findings by severity/age/reachability; runtime drift zero; clean-build reproducibility.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
