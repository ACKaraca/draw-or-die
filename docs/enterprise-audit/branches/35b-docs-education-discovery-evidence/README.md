# docs/education-discovery-evidence

| Field | Value |
|---|---|
| Priority / phase | P2 / Phase 0 parallel evidence gate |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED — required roles: product + privacy + finance |
| Target | UNSET — open only after the approved discovery operations are complete |
| Decision gates | D-019 |
| Blocked until | Protocol merged, evidence frozen, consent/retention verified, and operations closed |
| Effort / delivery risk | S–M / Low |
| Base | Protected `dev-main` documentation branch |
| Depends on | `docs/education-market-discovery` plus completed approved discovery operations |
| Accountable roles | Product/GTM + researcher + privacy + finance |

## Outcome

Record attributable, privacy-reviewed buyer and willingness-to-pay evidence and make an explicit `invest | revise | hold`
decision before a learner pilot or institution engineering.

## Evidence

The discovery protocol defines at least ten budget-holder interviews and three real priced proposals, but long-running
research operations should not keep a Git branch open or place raw participant material in the repository.

## Scope

- Import only approved redacted/aggregated evidence from the research system.
- Reconcile the planned sample, consent, withdrawals, proposal outcomes, and missing/contradictory observations.
- Distinguish enthusiasm from budget authority, procurement feasibility, signed intent, and paid commitment.
- Compare fixed pilot/service, included cohort allowance, and bounded per-active-learner pricing reactions without
  treating consumer Friends Team pricing as a school offer.
- Rank repeated workflow, governance, support, controller/minor, retention, and renewal requirements.
- Publish a decision memo with rejected hypotheses, uncertainty, next test, and `invest | revise | hold` result.

## Non-goals

No raw transcript, learner artifact, personally identifying research data, pilot enrollment, product code, or causal
learning-impact claim.

## Acceptance criteria

- [ ] Evidence covers at least ten qualified budget-holder interviews and three real priced proposal outcomes.
- [ ] Every included observation has approved provenance without exposing participant identity or private artifacts.
- [ ] Stated interest, budget authority, procurement, and payment evidence are reported separately.
- [ ] Repeated workflow/governance requirements and disconfirming evidence are visible.
- [ ] Decision memo records `invest | revise | hold`, owner, rationale, rejected hypotheses, uncertainty, and next gate.
- [ ] Research retention/withdrawal obligations are reconciled before merge.

## Approval and migration boundary

Product, privacy, and finance owners approve the evidence interpretation. No repository merge authorizes a pilot or
deletion of research material. Permanent deletion follows the approved research retention plan and explicit destructive
confirmation for the resolved target.

## Rollout

Freeze/close approved operations → open this short-lived evidence branch → independent evidence/privacy review → merge
the decision memo → close or revise the next commercial gate.

## Rollback

Withdraw or correct an unsupported synthesis through a new commit while preserving the decision/audit history. Do not
rewrite raw research systems or hide disconfirming evidence.

## Metrics and required artifacts

- Primary evidence: qualified interviews, priced-proposal outcomes, budget/procurement signals, and decision confidence.
- Required artifacts: redacted evidence matrix, sample/reconciliation report, proposal outcome log, and decision memo.
