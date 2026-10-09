# Stripe Entitlement Reconciliation Runbook

| Control | Value |
|---|---|
| Status | **DRAFT — DO NOT EXECUTE** |
| DRI | UNASSIGNED |
| Approver | UNASSIGNED — commerce/finance owner required for any correction |
| Environment / target | UNSET |
| Required permissions | Read-only reconciliation by default; separately approved scoped replay/counter-entry |
| Decision record | D-008/D-009 plus a correction approval record |
| Last tested | NEVER |
| Next review | Before each commerce drill or correction window |

The daily report is read-only. No replay, entitlement mutation, customer-value change, or counter-entry may run until
the exact discrepancy, expected effect, customer impact, rollback/compensation path, and approval are recorded.

## Daily read-only report

Join Stripe customer/subscription/invoice/payment/refund/dispute facts to internal event state, entitlement periods, and
ledger source entries. Report by currency and tier:

- missing or duplicate customer/subscription linkage;
- product/price/amount/currency/livemode mismatch;
- paid period without entitlement/allowance;
- entitlement without a valid paid/trial/policy source;
- cancel/refund/dispute/expiry not reflected;
- promo usage without an atomic quota record;
- duplicate or orphan ledger source;
- stale failed/processing event.

## Correction policy

- Never edit Stripe or ledger history to hide a mismatch.
- Prefer event replay for a missing idempotent effect.
- Use an approved counter-entry for customer value correction.
- Preserve customer access during investigation where fraud/security does not require suspension.
- Record currency, financial impact, customer communication, owner, and root cause.
- Stop after the proposed correction report and obtain commerce/finance approval before any replay or counter-entry.

## Release verification

Before and after each commerce release, reconcile the affected event window, run signed fixtures for renewal/cancel/
refund/dispute/promo, and prove Checkout redirect alone grants nothing.
