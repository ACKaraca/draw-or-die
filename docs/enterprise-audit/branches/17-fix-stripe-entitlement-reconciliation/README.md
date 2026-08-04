# fix/stripe-entitlement-reconciliation

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 3 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-008 and D-009 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `fix/stripe-webhook-idempotency`, `fix/atomic-rapido-ledger` |
| Accountable roles | Commerce + finance + product + QA |

## Outcome

Derive premium and purchased value from verified Stripe facts and a documented allowance/refund/promo contract.

## Evidence

Premium value is granted mainly at initial checkout, renewal invoices are not a complete allowance path, promotion quota/ID handling is ambiguous, success redirects imply success, customer reuse is incomplete, and reports mix currency/grants.

## Scope

- Validate product, price, amount, currency, livemode/account, payment state, customer, and user linkage.
- Handle invoice paid/failed, renewal, cancellation, period end, refund, dispute, upgrade/downgrade, and expiry.
- Implement the approved monthly/annual allowance and purchased-wallet contract.
- Consume internal promotion quota atomically and distinguish internal from Stripe promotion IDs.
- Reuse Stripe customers and prevent unintended parallel active subscriptions.
- Create scheduled replayable Stripe-to-entitlement-to-ledger reconciliation and customer remediation workflow.

## Non-goals

No new price, package, discount campaign, or UI experiment before the contract is approved.

## Acceptance criteria

- [ ] Checkout success URL alone grants nothing.
- [ ] Wrong product/price/amount/currency/livemode/account never provisions.
- [ ] Renewal/cancel/refund/dispute/expiry fixtures produce the approved entitlement and ledger entries.
- [ ] Duplicate and out-of-order events converge to the same correct state.
- [ ] Promotion quota is atomic and cannot apply twice or as both internal and Stripe discount.
- [ ] Existing Stripe customer is reused and duplicate active subscription is prevented.
- [ ] Daily reconciliation reports zero unexplained drift by currency and wallet type.

## Approval and migration boundary

Premium 200-Rapido cadence, rollover, annual tranches, wallet consumption, refunds, and promotion rules require product/finance owner approval before implementation.

## Rollout

Read-only reconcile current accounts → repair contract/data with approved adjustments → shadow new projection → small cohort → full authority.

## Rollback

Pause new Checkout/processor effects, preserve events, revert to the last known projection for access only, then replay after correction. Do not erase entitlements or events.

## Metrics and required artifacts

- Primary evidence: Stripe/entitlement/ledger drift zero; duplicate subscription, refund delay, and past-due correctness.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
