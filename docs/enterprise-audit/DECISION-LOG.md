# Decision Log

## Purpose

These decisions must be explicit before their dependent branches ship. “Recommended default” is the audit team's
starting position, not owner approval. Record the decision date, owner, rationale, rejected alternatives, and review
date in this file as decisions are made.

| ID | Decision required | Recommended default | Blocks | Status |
|---|---|---|---|---|
| D-001 | Intended behavior at the AI-route merge conflict | Reconstruct from both parents and contract tests; do not choose by deletion | All code branches | Required now |
| D-002 | Long-lived development branch reconciliation | Reconcile existing `dev-main` with the verified green baseline, then harden protection without rewriting history | Standard delivery | Required now |
| D-003 | Deployment source of truth | Select one documented platform/artifact promotion path; remove Vercel/Appwrite ambiguity | Release automation | Required now |
| D-004 | Historical auto-published gallery remediation | Inventory and contact/disable exposure; no destructive deletion without explicit owner approval | Trust reset | Required now |
| D-005 | Guest public publishing | Disallow until durable ownership and revocation exist | Gallery/community | Recommended |
| D-006 | Guest-to-account identity method | Preserve Appwrite identity if supported; otherwise atomic idempotent migration | Checkout and activation | Required |
| D-007 | Reward eligibility | Verified identity plus qualified activation; one reward per durable source | Referral/promo growth | Recommended |
| D-008 | Premium 200-Rapido contract | Monthly non-rollover allowance, separate purchased wallet, allowance spent first | Ledger/Stripe/packaging | Required |
| D-009 | Annual premium allowance | Monthly tranches, not a 2,400-unit upfront grant | Stripe reconciliation | Required |
| D-010 | Supported AI model and provider route | Stable model in a versioned registry with canary and rollback | AI release | Required now |
| D-011 | AI memory lifecycle | Immediate retrieval exclusion on delete; documented purge/backup expiry; no hidden profile inference by default | Privacy and AI | Required |
| D-012 | Supported locales | Complete Turkish and English first; hide incomplete German/Italian | Product/SEO/i18n | Recommended |
| D-013 | Product surface portfolio | Core/integrate/incubate/hold classification in Product Strategy | Navigation and investment | Required |
| D-014 | Basic history/save pricing | Do not charge for basic reliable resume; test paid extended storage/export separately | Packaging | Recommended |
| D-015 | Analytics stack and consent purposes | One versioned event source, distinct prod/dev, minimal downstream destinations | Growth/CRM | Required |
| D-016 | Privacy retention periods | Purpose-specific minimums validated by legal counsel and platform capability | Institution/publishing | Required |
| D-017 | Initial reliability objectives | Adopt proposed SLOs and correctness invariants, revise after baseline | Operations | Required |
| D-018 | Backup/restore objectives | Approve RPO/RTO by data class and fund the required storage/drills | DR/institution | Required |
| D-019 | Education pilot before institution platform | Paid, time-bounded pilots before reusable institution engineering; exact success threshold is D-027 | B2B build | Decided by owner |
| D-020 | ArchBuilder investment | Keep preview/incubation until one functional contract and demand metric are approved | Marketing and roadmap | Required |
| D-021 | Confessions brand ownership | Hold growth until safety staffing, purpose, and core-loop contribution are accepted | Community roadmap | Recommended |
| D-022 | Human expert add-on portfolio decision | Remove from the active product and monetization portfolio | None | Decided by owner; not planned |
| D-023 | Friends-team capacity and v1 roles | One owner plus up to five invited verified members; owner/member roles only | Team workspace | Decided by owner |
| D-024 | Shared Team Rapido authority | Separate team ledger account; approved funding; owner limits; members consume; no implicit personal transfer/fallback | Team wallet | Required |
| D-025 | Friends Team pricing unit | Team subscription/outcome pack with one shared allowance and owner-funded Team top-ups; price after cost/usage evidence | Team packaging | Required |
| D-026 | Education pricing unit | Fixed cohort pilot/service scope with included institutional allowance and optional bounded active-learner component | Education pilot/institution | Required |
| D-027 | Successful-pilot institution investment gate | Two reconciled paid pilots, zero unresolved P1 trust incident, positive contract economics, and at least one paid renewal/expansion | Institution engineering | Required |
| D-028 | Education artifact access and ownership | Personal work stays learner-owned; educator access is assignment-scoped, noticed, logged, purpose-bound, and portable at closeout | Pilot/cohort/reporting | Required |
| D-029 | Friends Team entitlement and residual value | Server-owned Team operation allowlist; no personal Premium; preserve purchased Team value on closure for approved reactivation/refund/credit treatment | Team wallet/packaging | Required |
| D-030 | Institution role separation | Separate organization owner/admin, billing admin, educator, learner, and time-bounded support authority | Institution tenancy | Required |
| D-031 | Education pilot isolation and funding | One isolated environment/namespace and cohort ledger per pilot; contract-backed server grant; overage off by default | Paid pilot enrollment | Required |
| D-032 | Institution billing authority and allowance | Billing-admin authority, organization-owned customer/ledger, exact-once funding, bounded overage, and explicit closeout | Institution billing | Required |

## Recorded owner decisions

### D-019 — Education pilot before institution platform

- Date: 2026-08-04
- Owner: Product owner
- Decision: Validate the school offer through successful paid, time-bounded pilots before building reusable institution
  management, cohort, role, or billing systems. D-027 remains required for the measurable `invest` threshold.
- Context and evidence: The owner requested school-appropriate pricing and explicitly gated institution capabilities on
  successful pilots; current demand, workflows, privacy burden, and renewal economics are not yet demonstrated.
- Alternatives rejected: Build the full institution platform before pilot evidence; reuse consumer Friends Team as the
  school contract; run unlimited or unpaid custom pilots.
- Consequences and risks: Pilot operations need their own isolated cohort controls; institution work remains blocked
  until D-027 evidence is approved.
- Review/expiry date: Review after each paid pilot closeout or an explicit owner scope change.
- Linked branch/PR: `docs/education-studio-pilot`, `feat/education-pilot-cohort-controls`,
  `docs/education-pilot-evidence`.

### D-022 — Remove Human Expert Add-on from the active portfolio

- Date: 2026-08-04
- Owner: Product owner
- Decision: Do not plan, price, market, or build a paid Human Expert Add-on.
- Context and evidence: The owner explicitly removed real architect/educator evaluation from the requested portfolio.
  Human review may remain only where required for moderation, appeals, or operational safety.
- Alternatives rejected: Marketplace, expert upsell, concierge expert review, or education pilot dependency on paid
  individual expert feedback.
- Consequences and risks: Product and monetization plans must not reintroduce the add-on implicitly; professional-limit
  disclosures remain mandatory.
- Review/expiry date: No automatic review; reopen only through a new explicit owner decision.
- Linked branch/PR: Enterprise product audit documentation package.

### D-023 — Friends Team capacity and v1 roles

- Date: 2026-08-04
- Owner: Product owner
- Decision: A Friends Team has one owner plus up to five invited verified members, for six active accounts maximum;
  v1 roles are `owner | member`.
- Context and evidence: The owner requested collaboration with up to five friends, shared Rapido consumption, and
  team-internal analysis. A small fixed cap creates a bounded first authorization and pricing contract.
- Alternatives rejected: Five total accounts, unlimited seats, school/cohort reuse, public collaboration, or complex
  v1 role hierarchy.
- Consequences and risks: Capacity and invite races must be atomic; owner transfer/removal, Team wallet authority,
  entitlement, and pricing remain gated by D-024, D-025, and D-029.
- Review/expiry date: Review after the paid Team canary or an explicit owner capacity change.
- Linked branch/PR: `feat/private-team-workspace`, `feat/shared-team-rapido-pool`, `feat/team-packaging`.

## Approval model

- Product owner approves product scope, privacy-facing behavior, pricing, and destructive remediation.
- Engineering owner approves architecture, migration, release, rollback, and operational feasibility.
- Security/privacy reviewer approves identity, publishing, storage, AI data, and institution controls.
- Finance/commerce owner approves Stripe contract, wallets, refunds, tax/currency reporting, and revenue metrics.
- Marketing/product analytics owner approves event purpose, experiment design, claims, and channel exposure.

In a solo operation, one person can hold several accountabilities, but high-risk changes still need independent review or
specialist advice. Approval roles describe responsibility, not headcount.

## Decision record template

```md
### D-XXX — Title

- Date:
- Owner:
- Decision:
- Context and evidence:
- Alternatives rejected:
- Consequences and risks:
- Review/expiry date:
- Linked branch/PR:
```
