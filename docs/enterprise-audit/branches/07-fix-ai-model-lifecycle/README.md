# fix/ai-model-lifecycle

| Field | Value |
|---|---|
| Priority / phase | P0 / Phase 1 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-010 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | M / High |
| Base | Protected `dev-main` |
| Depends on | `fix/release-build-blockers`, `fix/repository-release-gates`, `fix/p0-capability-containment` |
| Accountable roles | AI engineering + QA + privacy |

## Outcome

Move every AI surface from the retired preview default to a supported, tested stable policy with canary and safe rollback.

## Evidence

`google/gemini-3.1-flash-lite-preview` is the source default; official Google/Vercel pages record shutdown/removal before the audit date. Live environment overrides are unknown and the fallback handles only a narrow 403 message.

## Scope

- Verify production model environment values without printing secrets.
- Replace retired identifiers in source, examples, and docs after a representative multimodal smoke/eval.
- Create one minimal lifecycle policy for generation, gallery, Confessions, and portfolio surfaces.
- Classify 404/shutdown, capability mismatch, 429, timeout, and 5xx behavior.
- Reject blocked/retired identifiers at CI/startup/readiness and record actual model/provider.
- Canary a supported stable candidate and maintain only supported rollback candidates.

## Non-goals

No full prompt registry, cache redesign, progression redesign, or broad evaluation platform.

## Acceptance criteria

- [ ] No retired model identifier remains in active source/env examples/docs.
- [ ] Staging strict-JSON and image/PDF smoke succeeds on the actual selected model.
- [ ] Readiness fails for blocked/retired or modality-incompatible configuration.
- [ ] Actual model/provider and fallback attempt are visible without raw content.
- [ ] 404/shutdown never loops or silently bills a false success.
- [ ] Canary meets the critical quality/safety/schema/cost checks and rollback is rehearsed.

## Approval and migration boundary

Model/provider data terms and production route require privacy/security approval. Rollback can target only a supported eval-passed model.

## Rollout

Staging → 5% → 25% → 100% with schema, failure, latency, quality, and cost comparison.

## Rollback

Switch to the last supported champion via audited configuration; never return to the retired preview.

## Metrics and required artifacts

- Primary evidence: Retired-model request count zero; accepted-output, fallback, latency, and cost by actual model.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
