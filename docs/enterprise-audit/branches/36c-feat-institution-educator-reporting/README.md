# feat/institution-educator-reporting

| Field | Value |
|---|---|
| Priority / phase | P3 / Phase 8 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED — required roles: education/product + privacy + analytics + QA |
| Target | UNSET — assign only for pilot-validated educator decisions |
| Decision gates | D-027 and D-028 |
| Blocked until | Cohort/roster, event-quality, privacy-threshold, claims, and owner gates are green |
| Effort / delivery risk | M–L / Medium–High |
| Base | Protected `dev-main` |
| Depends on | `feat/institution-cohort-roster`, `feat/product-funnel-instrumentation`, `fix/privacy-data-lifecycle`, `feat/ai-trust-disclosure` |
| Accountable roles | Education product + privacy + analytics/data + frontend + QA |

## Outcome

Provide only the bounded educator evidence proven useful in paid pilots, without creating surveillance, ranking, or
revenue/AI-cost/conversion dashboards.

## Evidence

Educators may need assignment-level intervention evidence, while learners need privacy, ownership, and freedom from
automated grading. Pilot evidence—not generic engagement data—must define each report and threshold.

## Scope

- Map every report to a named educator decision, lawful/contractual purpose, authorized role, retention, and minimum cohort size.
- Provide aggregate cohort revision/assignment summaries only where the privacy threshold is met.
- Permit project-level educator access only under D-028 assignment authority; show access purpose and log every view/export.
- Separate reported learner work from personal projects, AI memory, other cohorts, and institution-internal finance data.
- Define suppression, small-cohort handling, late data, corrections, export, deletion, and audit behavior.
- Validate usefulness with educators and learners; remove reports that do not change an approved decision.

## Non-goals

No revenue, AI cost, margin, CAC, conversion, vanity-engagement, learner ranking, behavioral surveillance, automated
grading/discipline/admissions, predictive risk score, public leaderboard, or unrestricted raw-event export.

## Acceptance criteria

- [ ] Every field has an approved decision purpose, source event, owner, retention, role, and privacy threshold.
- [ ] Cross-organization/cohort leakage and below-threshold individual inference are zero.
- [ ] Project-level visibility is assignment-scoped under D-028 and every view/export is auditable.
- [ ] Learners can see the applicable access/ownership policy and exercise approved correction/export/delete rights.
- [ ] Revenue, provider cost, margin, CAC, and conversion data cannot enter educator or learner product responses.
- [ ] Suppression, deletion, late-event correction, role removal, and cohort closeout tests pass.
- [ ] Pilot/design-partner evidence shows the report supports a named educator decision without a trust regression.

## Approval and migration boundary

New events, derived fields, individual visibility, thresholds, exports, retention, and claims require product, educator,
privacy, analytics, and owner approval. Existing raw events are not repurposed without a compatible consent/purpose basis.

## Rollout

Offline redacted prototype → synthetic privacy tests → one approved aggregate report → educator/learner review → one
design-partner cohort → bounded expansion after usefulness and trust evidence.

## Rollback

Disable report generation and exports, preserve source records under their existing purpose/retention, revoke caches and
signed access, and retain audit evidence. Do not broaden access or substitute raw events.

## Metrics and required artifacts

- Primary evidence: Educator decision usefulness, report adoption, suppression rate, access denials, privacy incidents, and learner trust.
- Required artifacts: decision-to-field register, D-028 mapping, event lineage, threshold tests, role/export matrix,
  prototype research, rollout log, rollback proof, and claims review.
