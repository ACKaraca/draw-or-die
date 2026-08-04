# feat/revision-learning-loop

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 5 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-013 and D-014 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `refactor/ai-operation-registry`, `fix/revision-continuity`, `fix/atomic-rapido-ledger`, `feat/product-funnel-instrumentation`, `refactor/typed-analysis-state-machine`, `fix/core-flow-accessibility` |
| Accountable roles | Product + AI + design + data + QA |

## Outcome

Turn one-off critique into an evidence-linked action and same-project revision loop that demonstrates improvement.

## Evidence

The current experience generates critique but lacks stable issue identity, user action state, version comparison, resolved/regressed/new status, and a reliable project lineage. This is the strongest retention/monetization opportunity.

## Scope

- Return a bounded prioritized issue list with evidence, confidence/uncertainty, and next action.
- Let the user accept, defer, challenge, dismiss, or edit the action.
- Link base and revised artifact versions and compare resolved, partial, regressed, and new issues.
- Preserve user overrides and label AI conclusions advisory.
- Create private progress history and optional explicitly redacted/revocable share output.
- Measure Weekly Jury-Ready Iterations with AI quality, privacy, cost, refund, and support guardrails.

## Non-goals

No automated grade, professional approval, public-by-default sharing, or institution reporting surface.

## Acceptance criteria

- [ ] Issue IDs and evidence remain traceable across base/revision versions or explain non-match.
- [ ] User override is durable and never overwritten silently by the model.
- [ ] Resolved/regressed/new classification passes the educator eval rubric and schema gates.
- [ ] A full critique → action → revision → comparison E2E completes without duplicate charge.
- [ ] Private is default; share requires element-level consent/redaction and supports revocation.
- [ ] Accessibility and mobile core journey pass.
- [ ] Cohort experiment is preregistered and stops on any P0 guardrail.

## Approval and migration boundary

New project/issue schemas, share behavior, and pricing/allowance require product, privacy, data, and commerce approval.

## Rollout

Internal projects → consented beta → small verified cohort → compare to baseline → expand only on retained value and quality.

## Rollback

Disable new comparison/share UI while preserving immutable project/issues/user decisions and read-only history.

## Metrics and required artifacts

- Primary evidence: Weekly Jury-Ready Iterations; result→action→revision completion; issue usefulness/correction; guarded margin/trust.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
