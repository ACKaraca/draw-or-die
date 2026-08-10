# feat/product-funnel-instrumentation

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 4 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-015 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | L / Medium |
| Base | Protected `dev-main` |
| Depends on | `fix/privacy-data-lifecycle`, `feat/operational-observability`, `fix/guest-account-conversion` |
| Accountable roles | Product analytics + growth + privacy + commerce |

## Outcome

Create a consent-aware, queryable, reconciled event source for activation, revision, revenue, and experiments.

## Evidence

`/api/growth/conversion` validates then discards events, checkout omits UTM metadata expected by webhook, SPA pageview runs only on mount, and production/development share hardcoded analytics targets.

## Scope

- Define versioned typed event names, property allowlists, identities, timestamps, and idempotent IDs.
- Persist durable server outcomes and separate them from client intent.
- Stitch guest → registered identity without duplicate activation or purchase.
- Capture bounded consented first/last touch and pass a safe attribution ID through Checkout.
- Reconcile purchase/refund events to Stripe and wallet/entitlement outcomes.
- Separate production/development, route navigation, experiment assignment, freshness, and completeness.
- Block PII, filenames, prompts, critique, artifact URLs/content, and secret/internal IDs.

## Non-goals

No CRM campaign, paid acquisition, pricing experiment, or raw behavioral session replay.

## Acceptance criteria

- [ ] A valid event is durably accepted or recognized as an idempotent duplicate before success is returned.
- [ ] Synthetic consented funnel delivery is at least 95% and duplicate rate below 1%.
- [ ] Stripe purchases/refunds reconcile daily 100% to server events.
- [ ] Guest conversion preserves one identity lineage without double-counting.
- [ ] SPA and server route changes produce correct page/event context.
- [ ] PII/property-schema tests reject prohibited data.
- [ ] A reproducible internal query/report computes critique → action → revision and paid conversion from the durable source.

## Approval and migration boundary

Event purpose, consent, downstream vendors, retention, and allowed fields require privacy/product approval. UTM never affects price or entitlement.

## Rollout

A/A synthetic validation → internal traffic → small consented production cohort → two-week quality baseline → decision use.

## Rollback

Stop downstream export while preserving minimal audit events and schema versions; do not continue spend decisions on partial data.

## Metrics and required artifacts

- Primary evidence: Delivery, duplication, freshness, PII violations zero, Stripe reconciliation, identity stitching accuracy.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
