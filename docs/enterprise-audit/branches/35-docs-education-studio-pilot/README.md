# docs/education-studio-pilot

| Field | Value |
|---|---|
| Priority / phase | P2 / Phase 7 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-019, D-026, D-028, and D-031 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | M discovery/operations / Medium |
| Base | Protected `dev-main` |
| Depends on | `docs/education-discovery-evidence`, `feat/revision-learning-loop`, `fix/privacy-data-lifecycle`, `feat/ai-trust-disclosure`, `docs/incident-dr-release-runbooks`; no institution platform code |
| Accountable roles | Product/GTM + educator partner + privacy/security + support + finance |

## Outcome

Create the approved commercial, privacy, security, support, and measurement protocol for a bounded paid studio pilot
before investing in an institution platform.

## Evidence

Competitor first-party pages use 8–12 week, 15–60 learner pilots, while the repository has no verified institution
demand, role/tenant system, educator reporting evidence, or complete data-governance package.

## Scope

- Convert approved discovery evidence into one bounded pilot contract/proposal template.
- Define one studio/cohort, 15–60 learners, 8–12 weeks, onboarding, rubric, allowance, support, and outcome review.
- Define school-specific pricing: fixed pilot/service scope, included cohort Rapido, and an optional bounded
  per-active-learner component only when procurement evidence supports it.
- Define “active learner” from approved product activity rather than roster presence; keep overage disabled unless the
  budget holder gives written approval.
- Define a dedicated single-cohort data boundary, roster allowlist, least-privilege manual role matrix, audit evidence,
  isolated export/delete, and restore drill without shared organization tenancy.
- Document controller/processor roles, provider list, retention, export/delete, incident, minor policy, and non-grading boundary.
- Define learner/educator journeys, manual operations, escalation, and renewal decision.
- Define activation, critique/revision, usefulness, support, privacy/security, margin, and renewal evidence collection.
- Keep cohort allowance institution-owned; it never transfers to learner personal wallets. Limit school-visible finance
  data to invoice, allowance/approved overage, and contracted aggregate closeout information.
- Require `feat/education-pilot-cohort-controls` to provision a separate pilot boundary and cohort ledger before any
  learner enrollment; the protocol branch itself grants no access or Rapido.
- Create proposal, DPA checklist, pilot runbook, termination plan, and evidence report template.

## Non-goals

No Friends Team pricing/terms, unlimited use, outcome guarantee, automatic grading, SSO, full multi-tenant admin,
running a multi-month pilot inside a Git branch, causal learning claim, or unpaid custom-platform build.

## Acceptance criteria

- [ ] Contract template requires a paying budget holder, signed scope, data/AI boundaries, and named support owner.
- [ ] Isolated single-cohort access, export/delete, incident, and restore drills pass before learner enrollment.
- [ ] Measurement plan defines the 70% roster activation, median two loops, 50% one revision, and 4/5 usefulness hypotheses.
- [ ] Proposal defines price unit, included cohort Rapido, learner cap, support/onboarding, overage, refund, tax/currency,
  and renewal terms without using consumer Friends Team terms.
- [ ] Unused roster entries are not billable by default; overage is off by default and cohort value cannot become
  learner personal Rapido.
- [ ] Zero P1 privacy/security incident and truthful outcome limitations are hard stop/claims gates.
- [ ] No learner is automatically graded or disciplined by AI.
- [ ] The discovery decision memo authorizes a paid pilot before learner enrollment.
- [ ] D-031 and the education-pilot cohort-controls runbook are approved before roster import or allowance grant.
- [ ] A separate `docs/education-pilot-evidence` branch is required after operations; this protocol branch closes first.

## Approval and migration boundary

Contract, price, data processing, minors, support/SLA, research/claims, and artifact use need owner plus relevant legal/privacy/educator approval.

## Rollout

Approved discovery evidence → protocol/tabletop → merge and close this short-lived branch → implement and approve
`feat/education-pilot-cohort-controls` → isolated staging drill → run pilots operationally → open
`docs/education-pilot-evidence` after results are frozen.

## Rollback

Withdraw the protocol and stop enrollment. If a contracted pilot has started, honor termination, export/delete, support,
and evidence obligations; do not convert a failed pilot into a platform project.

## Metrics and required artifacts

- Primary evidence: Protocol approval, isolated-boundary drill, school price/proposal evidence, operational readiness,
  and measurement/termination quality.
- Required artifacts: contract/DPA templates, data/AI boundary checklist, onboarding/support/termination runbooks, metric
  dictionary, incident/escalation template, restore evidence, and results-report template.
- Closure requires the linked risk-register items to meet the global closure policy.
