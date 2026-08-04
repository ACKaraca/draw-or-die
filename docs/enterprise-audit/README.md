# Draw or Die Enterprise Product Audit

This directory is a decision and delivery package for moving Draw or Die from a promising solo-built product to a
reliable, measurable, and commercially defensible company-grade product.

## Audit snapshot

| Field | Value |
|---|---|
| Audit date | 2026-08-04 |
| Audited commit | `73465a7` (`origin/main`) |
| Documentation branch | `docs/enterprise-product-audit` |
| Production | `https://drawordie.app` |
| Development | `https://dev.drawordie.app` |
| Method | Repository, dependency, workflow, live-surface, product, market, and threat-model review |

This is not a compliance certification, penetration test, legal opinion, financial forecast, or production data audit.
The review did not have production database, Stripe Dashboard, Appwrite Console, Vercel analytics, or user research
access. Every recommendation that depends on those systems is marked as a hypothesis or validation requirement.

## Start here

1. [Executive brief](./EXECUTIVE-BRIEF.md) — decision summary and immediate company priorities.
2. [Audit method](./AUDIT-METHOD.md) — nine specialist workstreams, evidence hierarchy, and limitations.
3. [Evidence baseline](./EVIDENCE-BASELINE.md) — reproducible findings and audit limitations.
4. [Risk register](./RISK-REGISTER.md) — prioritized engineering, security, revenue, and product risks.
5. [Integrated roadmap](./ROADMAP.md) — dependency-ordered delivery program.
6. [Branch portfolio](./branches/README.md) — 52 separately foldered implementation plans, one per proposed Git branch.
7. [Delivery traceability](./TRACEABILITY.md) — risk, decision, branch, ownership, PR, merge, and verification lifecycle.
8. [Specialist review provenance](./REVIEW-PROVENANCE.md) — independent workstreams and incorporated challenge findings.

## Strategy documents

| Document | Decision it supports |
|---|---|
| [Product strategy](./PRODUCT-STRATEGY.md) | Who the product is for and what experience should win |
| [Monetization strategy](./MONETIZATION-STRATEGY.md) | Packaging, unit economics, wallets, and B2B expansion |
| [Marketing and GTM](./MARKETING-GTM.md) | Positioning, acquisition, lifecycle, SEO, and launch cadence |
| [Technology architecture](./TECHNOLOGY-ARCHITECTURE.md) | Target boundaries, migrations, API contracts, and sequencing |
| [Security and privacy](./SECURITY-PRIVACY.md) | Threat priorities, controls, verification, and incident readiness |
| [Quality and reliability](./QUALITY-RELIABILITY.md) | CI/CD, testing, observability, SLOs, and release governance |
| [AI and data strategy](./AI-DATA-STRATEGY.md) | Model lifecycle, evals, cost controls, and AI safety boundaries |
| [Metrics and experiments](./METRICS-EXPERIMENTATION.md) | North-star metric, event contract, scorecards, and experiment gates |
| [Decision log](./DECISION-LOG.md) | Decisions required before implementation can safely proceed |
| [P0 containment runbook](./P0-CONTAINMENT-RUNBOOK.md) | Immediate operator holds, stop conditions, and re-enable evidence |
| [Emergency change protocol](./EMERGENCY-CHANGE-PROTOCOL.md) | Safe additive controls before the full migration runner exists |

## Operating rule

Do not run product-growth branches in parallel with unresolved P0 integrity work. The branch portfolio is a dependency
graph, not a backlog to execute in arbitrary order. Each branch plan includes scope, non-goals, dependencies,
acceptance tests, rollout, rollback, and measurable outcomes.
