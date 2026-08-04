# feat/institution-billing-rapido

| Field | Value |
|---|---|
| Priority / phase | P2 / Phase 8 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED — required roles: finance/commerce + product + security + support |
| Target | UNSET — assign after approved institution price and cohort contracts |
| Decision gates | D-026, D-027, D-030, and D-032 |
| Blocked until | Institution tenancy/cohort contracts, pricing evidence, ledger/Stripe gates, and owners are green |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `feat/institution-cohort-roster`, `fix/atomic-rapido-ledger`, `fix/stripe-entitlement-reconciliation`, `feat/operational-observability`, `refactor/versioned-appwrite-migrations` |
| Accountable roles | Institution commerce + ledger/Stripe + finance + security + support + QA |

## Outcome

Implement the pilot-proven institution price, invoice, allowance, renewal, and billing-authority contract without reusing
consumer Team or personal-wallet products.

## Evidence

Pilot pricing is a bounded service/cohort proposal. A reusable institution system needs separate billing authority,
active-learner/cohort limits, Rapido liability, tax/currency, renewal, refund, and reconciliation behavior.

## Scope

- Create institution-specific products/prices and an organization-owned Stripe customer/subscription or approved invoice source.
- Separate organization owner/admin authority from billing-admin authority under D-030.
- Fund an organization/cohort ledger account exactly once from paid, reconciled contract events.
- Enforce included institutional allowance, cohort/active-learner limits, approved overage cap, expiry, renewal, refund,
  credit note, dispute, cancellation, grace, and closeout behavior under D-032.
- Preserve personal, Friends Team, education-pilot, purchased, allowance, promo, and institution value as distinct sources.
- Reconcile currency, tax, invoice, entitlement, ledger, usage liability, support adjustment, and contribution evidence.
- Provide authorized billing users only invoices, contract allowance/expiry, approved overage, adjustments, and support paths.

## Non-goals

No consumer Team conversion, per-seat Premium grant, personal-wallet fallback, peer transfer, cash-out, public margin/AI
cost dashboard, free custom contracts, unlimited allowance, roster workflow, or educator reporting.

## Acceptance criteria

- [ ] Only authorized billing admins can quote/accept, purchase, refill, change, cancel, or view institution billing.
- [ ] URL, email domain, roster role, or client state cannot create an institution entitlement or change price.
- [ ] Paid activation and renewal fund the correct organization/cohort account exactly once.
- [ ] Concurrent usage cannot overspend, debit another organization/personal/Team wallet, or bypass an approved overage cap.
- [ ] Failed payment, refund, credit, dispute, cancellation, grace, owner/admin change, and webhook replay reconcile safely.
- [ ] Active-learner billing uses the deterministic cohort contract; unused roster entries are not billable by default.
- [ ] TRY/USD, tax, invoice, Rapido liability, provider/support cost, and contribution evidence remain attributable by contract.
- [ ] Institution products, price IDs, and allowance sources are distinct from individual, Team, and pilot catalogs.

## Approval and migration boundary

D-032, price/allowance, tax/currency, existing-customer treatment, billing roles, Stripe products, ledger migration, refunds,
and support contract require owner/finance/security approval. No historical pilot value migrates automatically.

## Rollout

Contract fixtures → Stripe/invoice test mode → synthetic renewal/refund/replay → one design-partner organization → full
reconciliation period → second organization → bounded availability.

## Rollback

Stop new institution sales/funding while preserving portal, cancellation, refund/credit, contracted access, exports,
immutable journal, and support. Never move remaining value to Team or personal wallets.

## Metrics and required artifacts

- Primary evidence: Wrong-organization charges, duplicate/lost funding, unexplained drift, and unauthorized billing actions are zero.
- Required artifacts: canonical billing contract, role/authority matrix, unit-economics model, signed fixtures, replay/fault
  tests, reconciliation report, rollout log, rollback proof, and customer communications.
