# feat/premium-packaging

| Field | Value |
|---|---|
| Priority / phase | P2 / Phase 6 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-008, D-009, and D-014 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | L / High |
| Base | Protected `dev-main` |
| Depends on | `fix/stripe-entitlement-reconciliation`, `fix/atomic-rapido-ledger`, `feat/product-funnel-instrumentation`, `feat/revision-learning-loop` |
| Accountable roles | Product + finance/commerce + growth analytics + QA |

## Outcome

Package proven revision outcomes under one explicit free, allowance, purchased-credit, expiry, refund, and renewal contract.

## Evidence

Source/project rules disagree on operation costs and mentor/preservation access; premium 200 Rapido cadence is ambiguous; initial checkout raises balance but renewal behavior is incomplete; operation contribution cost is not yet visible.

## Scope

- Record the approved free/registered/premium/purchased-wallet contract in pricing and user-facing copy.
- Separate recurring allowance from non-expiring purchased value and define consumption order.
- Implement approved monthly/annual tranches, rollover, expiry, cancel, refund, and downgrade behavior.
- Design contextual Jury Week, Revision Sprint, and Jury Prep hypotheses as outcome packages.
- Use server-confirmed prices/entitlements and accessible Turkish/English UI through i18n.
- Pre-register conversion, contribution margin, retention, refund, and trust guardrails.

## Non-goals

No price change before COGS baseline, unlimited claim, manufactured urgency, or charging for privacy/account recovery/basic reliability.

## Acceptance criteria

- [ ] One canonical server contract covers UI, Checkout, webhook, ledger, docs, and support.
- [ ] Purchased and allowance balances remain distinct through spend/refund/expiry.
- [ ] Monthly/annual renewal fixtures grant exactly the approved amount and time period.
- [ ] All costs come from `lib/pricing.ts` or the approved successor; no hardcoded UI values.
- [ ] Operation/package contribution margin is queryable by currency/tier.
- [ ] Experiment assignment and fulfillment are idempotent and refund-safe.
- [ ] A losing variant is stopped without changing existing customer entitlements.

## Approval and migration boundary

The 200-Rapido cadence, rollover, annual tranches, prices, package contents, refund, and expiry require explicit owner/finance approval before code.

## Rollout

Contract and support docs → internal/test customers → one low-exposure packaging/message experiment → expand only on retained margin and trust.

## Rollback

Stop new enrollment/experiment, honor already purchased/advertised terms, and keep ledgers/entitlements intact.

## Metrics and required artifacts

- Primary evidence: Paid conversion and contribution margin with revision retention, refund/dispute, support, and trust guardrails.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
