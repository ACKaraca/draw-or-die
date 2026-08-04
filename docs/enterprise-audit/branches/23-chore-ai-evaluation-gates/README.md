# chore/ai-evaluation-gates

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 4 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-010 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | XL / Medium |
| Base | Protected `dev-main` |
| Depends on | `refactor/ai-operation-registry`; dataset work may begin earlier |
| Accountable roles | AI quality + architecture educators + privacy + QA |

## Outcome

Make model, prompt, schema, preprocessing, and cache changes evidence-gated rather than build-gated.

## Evidence

No eval dataset/manifest/runner, prompt golden suite, AI route production test, model/prompt provenance, or candidate/champion comparison exists.

## Scope

- Create a permissioned/de-identified 80–120 artifact manifest with dev and locked holdout sets.
- Use at least two calibrated architecture educators and an issue/evidence/action rubric.
- Add injection, PII, malformed file/output, cache, deletion, bbox, language, safety, and counterfactual sets.
- Build reproducible runner with dataset/model/prompt/schema/preprocessor hashes.
- Run small PR smoke, nightly full eval, and promotion artifact with quality/cost/latency deltas.
- Keep sensitive holdout assets out of public logs and unauthorized repository history.

## Non-goals

No claim of pedagogical causality, automated grading, or optimization to exact reference prose.

## Acceptance criteria

- [ ] 100% of successful responses are runtime-schema valid.
- [ ] Critical injection, PII echo, hate/threat, and deleted-memory inclusion gates remain zero.
- [ ] Visible-fact, issue-recall, actionability, repeatability, fairness, harshness, and bbox gates are computed reproducibly.
- [ ] A deliberately regressed candidate blocks promotion.
- [ ] Eval artifact records consent/license/retention/annotation provenance.
- [ ] Model/prompt/schema changes cannot merge without the applicable report.
- [ ] Raw holdout content never appears in normal telemetry/artifacts.

## Approval and migration boundary

Dataset consent/license, retention, annotator access, and gate changes require privacy plus AI-quality owner approval.

## Rollout

Calibrate a small seed set → lock rubric → expand dataset → advisory reports → blocking critical gates → blocking full promotion policy.

## Rollback

Revert the candidate model/prompt/schema to the last supported champion; never weaken a failed critical safety/privacy gate to ship.

## Metrics and required artifacts

- Primary evidence: Gate pass/regression by version; inter-rater calibration; eval reproducibility and data-access audit.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
