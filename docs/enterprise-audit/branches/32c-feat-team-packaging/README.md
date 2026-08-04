# feat/team-packaging

| Field | Value |
|---|---|
| Priority / phase | P2 / Phase 6 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED — required roles: product + finance/commerce + privacy/support |
| Target | UNSET — price only after validated team usage and cost evidence |
| Decision gates | D-023, D-024, D-025, and D-029 |
| Blocked until | Workspace, pool, individual packaging, event quality, and unit-economics evidence are green |
| Effort / delivery risk | M / Medium–High |
| Base | Protected `dev-main` |
| Depends on | `feat/private-team-workspace`, `feat/shared-team-rapido-pool`, `feat/premium-packaging`, `fix/stripe-entitlement-reconciliation`, `feat/product-funnel-instrumentation` |
| Accountable roles | Product/monetization + commerce/finance + growth + privacy/support + QA |

## Outcome

Offer a clear friends-team package for one owner plus up to five invited members, private team analysis, and shared
Rapido without mixing it with individual Premium or school/institution contracts.

## Evidence

No current price or usage evidence covers team seats, shared Rapido concurrency, owner/member support, unused pool
liability, shared-project storage, abuse, or incremental AI contribution cost.

## Scope

- Define the Team contract: capacity, included private workspace, shared analysis/revision, shared allowance, refill, and limits.
- Test a team subscription and/or time-bounded team outcome pack only after cost and demand evidence exists.
- Keep individual Premium, personal Rapido, and team value visibly and contractually separate.
- Price from provider/storage/payment/support cost, expected member utilization, refunds, and target contribution margin.
- Define trial, upgrade/downgrade, member-cap changes, cancellation, refund, pool expiry, and existing-customer treatment.
- Publish the D-029 Team operation allowlist and cancellation/closure treatment for unused allowance and purchased value.
- Allow only the billing owner to purchase/refill team value in v1; members cannot alter funding or billing.
- Grant one shared periodic allowance per team—not one allowance per seat—and keep member personal Premium unchanged.
- Bound pending invites/rate as well as active seats; accepting an invite creates no referral reward.
- Validate one canonical contract across pricing UI, Checkout, webhook, entitlement, ledger, support, and localized copy.
- Hand school leads to the separate Education Studio pilot; do not sell a friends team as a school data contract.

## Non-goals

No numeric price commitment before evidence, unlimited shared Rapido, school/institution pricing, free balance transfer,
hidden seat fee, automatic personal-wallet fallback, marketplace, or referral emission increase.

## Acceptance criteria

- [ ] One published Team contract matches UI, Checkout, webhook, entitlement, ledger, cancellation, refund, and support.
- [ ] Capacity is enforced server-side as one owner plus no more than five invited active members.
- [ ] Team and personal value, charges, expiries, invoices, and customer communications are unambiguous.
- [ ] Team UI exposes only authorized shared balance, expiry, member limits, operation debits, invoices/refunds, and
  support controls—not provider cost, platform revenue, margin, CAC, or conversion.
- [ ] Team Stripe products/prices and allowance sources are separate from individual student and education-pilot catalogs.
- [ ] Renewal funds the team pool exactly once; payment failure, cancel, refund, dispute, and owner transfer replay safely.
- [ ] Closing a team cannot strand, erase, personally transfer, or double-refund purchased Team value; D-029 copy and
  ledger treatment match.
- [ ] A paid canary has attributable team activation, shared revision, utilization, support, refund, and contribution-cost evidence.
- [ ] Price/allowance variants have pre-registered stop rules and cannot create negative contribution or unsafe overuse.
- [ ] School prospects receive the Education Studio contract and pricing process, never consumer Team terms by default.
- [ ] Education-domain eligibility never silently changes Team price, allowance, or contract.

## Approval and migration boundary

D-025 approves the pricing unit and experiment envelope after verified unit economics. Any price, allowance, tax/currency,
refund, or existing-customer change requires owner/finance approval and updated Turkish/English customer contracts.

## Rollout

Demand interviews → non-binding package test → internal/test-mode purchase → small paid team canary → fixed observation
window → ship, revise, or stop. School pricing follows its own proposal/pilot evidence process.

## Rollback

Stop new Team sales/experiments while honoring existing access, shared value, cancellation, refund, export, and support
contracts. Do not convert teams to individual or school plans automatically.

## Metrics and required artifacts

- Primary evidence: Qualified team demand, team activation, shared revision loops, pool utilization, support/refund, and contribution margin.
- Required artifacts: unit-economics model, canonical contract, experiment record, test-mode proof, paid-canary report, and rollback copy.
