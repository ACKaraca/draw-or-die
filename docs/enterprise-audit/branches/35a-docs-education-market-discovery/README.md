# docs/education-market-discovery

| Field | Value |
|---|---|
| Priority / phase | P2 / Parallel discovery from Phase 0 |
| Status | Planned |
| DRI | UNASSIGNED — workstream must not start collecting data |
| Approver | UNASSIGNED — required roles: product owner + privacy owner for research handling |
| Target | UNSET — protocol authoring may run while technical P0 work proceeds |
| Decision gates | D-019 plus research consent, storage, recruitment, and claims review |
| Blocked until | No code dependency; no learner artifact or pilot enrollment is allowed |
| Effort / delivery risk | M / Low |
| Base | Protected `dev-main` documentation branch |
| Depends on | None for interviews/proposals; paid pilot depends on later gates |
| Accountable roles | Product/GTM + educator researcher + privacy + finance |

## Outcome

Create an approved research and priced-proposal protocol that can prove the buyer, problem, workflow, governance needs,
and willingness to pay before institution engineering.

## Evidence

The repository contains broad education ambitions but no verified budget-holder demand, procurement path, pilot renewal,
or validated educator decision workflow.

## Scope

- Define recruitment, consent, incentives, notes/storage/retention, redaction, and withdrawal procedures.
- Create educator/budget-holder and bounded student interview guides using current-workflow artifact walkthroughs.
- Create three priced-proposal test templates for a one-studio, 8–12 week, 15–60 learner pilot.
- Define evidence fields for buyer, procurement, rubric, intervention, support, controller, minors, retention, and renewal.
- Define `invest | revise | hold` thresholds and a decision-memo/evidence-matrix template.

## Non-goals

No production code, roster upload, student data processing, interviews/proposal operations inside a long-lived Git branch,
free custom build, signed learning-impact claim, or pilot start.

## Acceptance criteria

- [ ] Research plan, consent, notes retention, recruitment, incentives, and withdrawal are approved before operations.
- [ ] Interview/proposal instruments distinguish stated interest from budget/procurement commitment.
- [ ] Evidence schema can rank repeated educator decisions and governance needs without raw learner artifacts.
- [ ] Thresholds require at least ten budget-holder interviews and three real priced proposals.
- [ ] Decision template records rejected hypotheses/uncertainty and forbids causal learning-impact claims.

## Approval and migration boundary

No schema or product migration. Any move from proposal to learner enrollment transfers to
`docs/education-studio-pilot` and its full privacy/security gates.

## Rollout

Draft protocol/templates → privacy/product/finance review → merge and close this short-lived branch → run operations in
the approved research system → open `docs/education-discovery-evidence` only after evidence is frozen.

## Rollback

Withdraw or version the protocol and stop recruitment. If operations have started, revoke access and quarantine
research material under the approved retention plan. Permanent deletion requires an exact resolved target,
retention/legal check, dry-run inventory, and the owner's explicit `evet`, `tamam`, or equivalent Turkish destructive
confirmation immediately before execution.

## Metrics and required artifacts

- Primary evidence: protocol approval, instrument completeness, privacy/data handling, and decision-threshold quality.
- Required artifacts: research plan, consent script, interview/proposal instruments, evidence schema, and decision template.
