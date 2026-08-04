# Monetization Strategy

## Commercial thesis

Sell improved jury readiness, not a menu of AI operations. Rapido can remain the internal value unit, but the external
offer should be understandable as an outcome: a quick critique, a revision sprint, jury-week preparation, portfolio
improvement, a private friends-team workspace, or a studio pilot.

Revenue expansion is unsafe until the wallet, webhook, identity, consent, and cost-accounting controls in the risk
register are closed.

## Existing contract snapshot

The audited source defines:

- guest and anonymous starting balance: 4 Rapido;
- registered starting balance: 15 Rapido;
- premium target balance: 200 Rapido;
- minimum purchased pack: 5 Rapido;
- TRY Rapido list price: 3.95 TRY per unit;
- global Rapido list price: USD 0.79 per unit;
- premium list prices: 149 TRY/month for Akdeniz, 299 TRY/month for other verified Turkish students, and USD 15/month
  globally, with annual variants.

Current operation list-price equivalents are not contribution margin or provider cost:

| Operation | Rapido | TRY equivalent | USD equivalent |
|---|---:|---:|---:|
| Single jury | 4 | 15.80 | 3.16 |
| Same-project revision | 1 | 3.95 | 0.79 |
| Multi-jury | 10 | 39.50 | 7.90 |
| Material board | 3 | 11.85 | 2.37 |
| Defense | 4 | 15.80 | 3.16 |
| Premium rescue | 6 | 23.70 | 4.74 |
| Portfolio page | 4 | 15.80 | 3.16 |

The source and project rules disagree on some operation costs and entitlement details, including `AUTO_CONCEPT`, mentor
access, and preservation pricing. Resolve those contracts before publishing new offers.

## Stop-the-line revenue integrity

### Wallet model

A single mutable `rapido_pens` counter cannot explain customer value. Introduce append-only accounts or balance buckets:

| Wallet | Funding source | Expiry | Refund/chargeback behavior |
|---|---|---|---|
| Purchased | Stripe one-time purchase | Never by default | Reverse unused value per policy; ledger link required |
| Subscription allowance | Paid subscription period | At period boundary | Suspend future use; preserve audit history |
| Earned | Peer/referral action | Policy-defined | Void fraudulent or reversed source event |
| Promotional | Campaign/promo | Explicit timestamp | Expire through ledger entry, never silent overwrite |

Every mutation needs an idempotency key, source type/ID, signed amount, currency context where applicable, event time,
status, and resulting balance projection. AI work should use `reserve → settle | void`; failed requests must not consume
value, and concurrent requests must not exceed available balance.

### Stripe state

Webhook delivery is a state machine, not a boolean:

`received → processing → succeeded | failed`

Validate event environment, account, payment state, expected product/price/amount/currency, user linkage, and replay.
Handle checkout completion, paid invoices, renewal, past due, cancellation, refund, dispute, and promotion consumption.
Run scheduled reconciliation against Stripe and ledger projections. The checkout success URL is never entitlement proof.

### Premium allowance decision

The current code raises the user's balance to at least 200 on initial checkout but does not express a complete recurring
allowance contract. Decide and document:

1. Is 200 granted per billing month, per subscription term, or once?
2. Does unused allowance roll over?
3. Does annual premium grant monthly tranches or an annual pool?
4. Which wallet is consumed first?
5. What happens on payment failure, cancellation-at-period-end, refund, upgrade, and downgrade?

Recommended default to test: non-rollover subscription allowance refreshed by period, purchased value kept separately
and non-expiring, allowance consumed before purchased value. This is a hypothesis, not an approved change.

## Unit-economics instrumentation

Do not change pricing until each operation records:

- model and provider route;
- input/output tokens and image/PDF processing units;
- provider price version and estimated provider cost;
- storage, moderation, and supporting API cost;
- retries, fallback calls, timeout, and failure reason;
- Rapido reserved, settled, voided, refunded, or granted;
- gross payment, discount, tax, fee, refund, dispute, and currency;
- support, moderation, and required operational labor cost for the offer;
- experiment and acquisition attribution without PII.

Required internal finance/operations reports. These are access-controlled operator artifacts, not product UI:

- contribution margin per successful operation and package;
- margin per active paid user and tier;
- allowance utilization distribution;
- unused purchased liability;
- grant/promo/referral emission and fraud loss;
- refund, dispute, and failed-payment rate;
- model fallback cost and quality delta;
- daily Stripe-to-ledger-to-profile reconciliation.

Never aggregate TRY and USD into one revenue total without an explicit date-stamped FX conversion layer. Grants are not
purchases.

## Packaging ladder

### Free / registered

- one complete quick critique to demonstrate real value;
- private result and reliable account conversion;
- limited recent history and one clear revision path;
- sample mentor/defense value without misrepresenting full access.

The exact free allowance must be abuse-tested. It should optimize verified activation, not raw sign-ups.

### Student premium

- defined recurring allowance;
- multi-jury, rescue, defense, mentor, longer history, and project continuity;
- priority or stronger-model routing only when quality and cost evidence supports it;
- no “unlimited” claim without enforceable fair-use economics.

### Outcome packs

Test only after ledger and attribution integrity:

- **Jury Week Pass:** a 7- or 14-day deadline bundle;
- **Revision Sprint:** initial critique plus two same-project comparisons and defense rehearsal;
- **Jury Prep Pack:** multi-jury, rescue, defense, and mentor allowance;
- **Portfolio Season:** whole-document prioritization, follow-up checks, and a controlled export/share artifact.

Packages need explicit validity, wallet funding, refund, renewal, and expiry contracts. Do not hide the effective Rapido
value or manufacture countdown urgency.

### Friends Team

Plan a separate collaboration offer for one owner plus up to five invited verified members:

- private team workspace, shared projects, team analysis, actions, and revision history;
- a shared Rapido pool that remains separate from every member's personal wallet;
- owner-only funding, member limits, pause, removal, and auditable operation-level consumption;
- one periodic non-rollover Team allowance plus owner-purchased Team top-ups that do not expire by default;
- allowance-first consumption; no personal, referral, earned, promo, or student allowance transfer into the pool;
- explicit capacity, allowance, refill, expiry, cancellation, refund, and data/export terms;
- bounded pending invites and no referral reward merely for joining a team;
- a versioned Team operation allowlist: Team value funds only authorized team-project analyses/revisions and never grants
  personal Premium or pays for a personal-project operation;
- explicit cancellation/closure treatment for unused allowance and owner-purchased Team value, with no silent personal
  transfer, forfeiture, cash-out, or double refund;
- no public sharing, school data processing, unlimited-use claim, or implicit personal Rapido transfer.

Do not set a numeric price yet. First validate invite-to-active-team behavior, analyses and revisions per active team,
shared-pool utilization, provider/storage/payment/support cost, refund risk, and willingness to pay. Test a clear team
subscription and/or time-bounded team preparation pack only after the workspace and atomic pool are safe.

### Education Studio pilot

Sell a paid, bounded service before a platform:

- one cohort or studio;
- 15–60 students as an initial validation envelope;
- 8–12 weeks;
- onboarding, usage allowance, educator rubric, support, and outcome review;
- a separately provisioned pilot boundary and cohort-owned ledger for every school;
- privacy/data-processing package and “not a grade” boundary;
- renewal decision with written reasons.

School pricing is a separate contract from Friends Team. Test a fixed pilot/service fee with an included cohort Rapido
allowance and, where procurement prefers it, a clearly bounded per-active-learner component. Support/onboarding,
retention, refunds, tax/currency, learner limits, and overage behavior must be explicit. Institution pricing and features
follow budget-holder proposals, paid pilot evidence, and renewal/expansion—not consumer Team pricing.

Define an active learner deterministically from approved product activity; a rostered but unused seat is not billable by
default. Overage starts disabled and requires written budget-holder approval. Cohort allowance never transfers into a
learner's personal wallet. Do not offer free custom builds, unlimited use, automatic grading, or outcome guarantees.
Do not enroll learners until `feat/education-pilot-cohort-controls` proves the contract-backed allowance, overage,
cross-pilot isolation, reconciliation, export/delete, and restore path.

## Market anchors, not price recommendations

Public first-party pages accessed 2026-08-04 show several packaging patterns:

| Product | Public pattern | What it tests |
|---|---|---|
| [Critsly](https://critsly.com/pricing.html) | Paid pilot, per-active-student monthly, annual institution tiers | Education procurement and usage-based seats |
| [Critsly pilots](https://critsly.com/pilots.html) | 8–12 weeks, one cohort, 15–60 students | Bounded pilot scope and outcome review |
| [DeskCrit](https://deskcrit.ca/) | One-off portfolio report | Deadline-driven transaction |
| [Portfolio Reviewer](https://portfolioreviewer.org/) | Free preview and report/pass | Portfolio outcome ladder |
| [ClearHandoff](https://www.clearhandoff.com/en/pricing/) | Review volume, seats, enterprise controls | B2B usage plus governance |

These pages do not prove Draw or Die willingness to pay or market size. Use them to design interviews and controlled
tests, not to copy prices.

## Experiment sequence

1. Repair ledger, Stripe, identity, consent, and attribution.
2. Measure two weeks of validated baseline behavior and operation margin.
3. Test message and package presentation without changing fulfillment.
4. Test Jury Week versus monthly premium on comparable deadline cohorts.
5. Test Revision Sprint versus individual Rapido purchase.
6. Validate friends-team demand and shared-pool usage before committing a Team price.
7. Test Team packaging only after workspace, wallet, and cost controls pass.
8. Run separate paid education proposal tests and isolated cohort controls before operating pilots or engineering
   institution features.
9. Stop variants that increase purchase but reduce revision completion, trust, or margin.

## Monetization guardrails

- Never charge for privacy, deletion, account conversion, basic failure recovery, or access to purchased value.
- Never reward raw sign-up; reward verified activation or a quality-controlled contribution.
- Never count issued Rapido as revenue.
- Never provision from a redirect or client flag.
- Never make a paid regulatory, accessibility, structural, or egress assurance claim.
- Never expand promotional emission before fraud, ledger, and reconciliation controls.
- Never sell ArchBuilder or institution capabilities as complete before acceptance evidence exists.
