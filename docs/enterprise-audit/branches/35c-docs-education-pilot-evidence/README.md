# docs/education-pilot-evidence

| Field | Value |
|---|---|
| Priority / phase | P2 / Phase 7 closure |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED — required roles: product + privacy/security + finance + educator partner |
| Target | UNSET — open only after two contracted pilot operations close |
| Decision gates | D-019, D-026, D-027, D-028, D-031, signed pilot closeout, and paid renewal/expansion evidence |
| Blocked until | Pilot protocol/controls merged, two paid pilots closed, evidence frozen, and obligations reconciled |
| Effort / delivery risk | S–M / Medium |
| Base | Protected `dev-main` documentation branch |
| Depends on | `docs/education-studio-pilot`, `feat/education-pilot-cohort-controls`; plus two completed paid pilot operations |
| Accountable roles | Product/GTM + educator partner + privacy/security + support + finance |

## Outcome

Record redacted pilot outcomes, trust/support burden, economics, and renewal decisions so institution investment is an
evidence-based gate rather than momentum from a long-running project.

## Evidence

The approved pilot protocol and cohort-controls branch define bounded operations and measures. Institution engineering
requires results from two paid pilots and at least one attributable paid renewal or expansion.

## Scope

- Reconcile signed scope, enrollment, access, incidents, support, termination, export/delete, and restore evidence.
- Prove each pilot used its own approved environment/namespace and cohort ledger with zero cross-pilot access/value drift.
- Report activation, critique/revision distribution, educator usefulness, learner feedback, and limitations.
- Reconcile contracted revenue, provider/support cost, refunds/credits, and contribution margin in the restricted
  internal finance evidence; never expose provider cost, margin, or conversion to learner/educator product surfaces.
- Compare the approved school pricing unit, included cohort Rapido utilization, learner cap, overage, and renewal economics.
- Record each budget holder's written renew/not-renew/expand decision and conditions.
- Publish `invest | revise | hold` recommendation for institution foundation with unresolved risks.

## Non-goals

No raw learner artifact, individual grading/ranking, personally identifying result, causal learning claim, pilot
operation inside Git, institution code, or rewriting an unfavorable outcome.

## Acceptance criteria

- [ ] Two paid pilots have signed closeout and reconciled data/support/financial obligations.
- [ ] At least one has an attributable paid renewal or expansion; otherwise the institution result is `hold` or `revise`.
- [ ] Activation, revision, usefulness, support, margin, incident, and deletion/export measures use the approved dictionary.
- [ ] Zero unresolved P1 privacy/security incident is required for an `invest` recommendation.
- [ ] Positive contract-level contribution evidence and zero unexplained cohort-ledger drift are required for `invest`.
- [ ] Every learner-facing outcome is aggregated/redacted and explicitly non-grading.
- [ ] Recommendation records limitations, disconfirming evidence, owner, decision, and review date.

## Approval and migration boundary

Product, educator, privacy/security, and finance owners approve the closeout. The evidence branch authorizes no tenant
schema, migration, new enrollment, or destructive cleanup. Those require their own branch and approval.

## Rollout

Close and reconcile both separately isolated pilot operations → freeze approved evidence → open this short-lived branch
→ independent review → approve D-027 or record `hold/revise` → start or hold institution-foundation planning.

## Rollback

Correct unsupported calculations or claims through a new reviewed commit and preserve previous decisions. Do not alter
source contracts, participant records, or financial ledgers to improve the report.

## Metrics and required artifacts

- Primary evidence: paid closeout, renewal/expansion, revision outcomes, educator usefulness, support burden, margin,
  and trust incidents.
- Required artifacts: redacted pilot scorecards, obligation/reconciliation report, written buyer decisions, limitations,
  and institution investment memo.
