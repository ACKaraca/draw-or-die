# Audit Method

## Review model

The audit used nine specialist review workstreams followed by a central evidence synthesis:

1. architecture and code-structure review;
2. security and privacy threat review;
3. monetization, billing, wallet, and unit-economics review;
4. product management, user journey, UX, accessibility, and design-system review;
5. marketing, growth, SEO, lifecycle, and education GTM review;
6. QA, SRE, CI/CD, release, dependency, observability, and disaster-recovery review;
7. AI, data, model lifecycle, evaluation, cache, memory, and moderation review;
8. independent program-portfolio red-team for sequencing, branch scope, approvals, and rollback boundaries.
9. independent documentation red-team for contradictions, unsafe execution language, ownership gaps, links, and
   implementation readiness.

The program red-team explicitly challenged the first synthesis. It moved minimum observability ahead of financial
migrations, moved the retired AI model into the immediate containment phase, separated event instrumentation from SEO,
split Stripe event idempotency from entitlement reconciliation, and prevented App Router refactoring from blocking the
revision product.

The documentation red-team then separated immediate containment from full remediation, split search identity and
education discovery into independent branches, hardened destructive runbooks, and required named ownership and gates
before any planned branch can start.

Follow-up specialist challenge passes and their incorporated findings are recorded in
[Specialist Review Provenance](./REVIEW-PROVENANCE.md).

## Evidence sources

### Repository

- tracked source, configuration, tests, scripts, lockfile, and documentation at commit `73465a7`;
- domain instructions in `AGENTS.md` and `AGENTS_DESIGN.md`;
- both interactive HTML design source-of-truth artifacts;
- Git history around the unresolved conflict;
- GitHub workflow and branch-protection read-only responses;
- clean dependency install, lint, typecheck, test/coverage, audit, and static scans.

### Live read-only surfaces

- production and development root/health responses;
- canonical, metadata, robots, sitemap, and indexability;
- deployment/release identifiers where exposed;
- no mutations, accounts, payments, or uploads were created.

### External primary sources

- official provider model, pricing, structured-output, safety, gateway, and terms pages;
- official Google Search and Analytics documentation;
- first-party competitor product, pricing, pilot, and security pages;
- primary research papers and institutional guidance where relevant.

External claims are dated 2026-08-04 and framed as market/product signals, not market-size proof or legal advice.

## Evidence hierarchy

1. Reproducible production-path behavior or failing check.
2. Direct source/control flow with exact file/line evidence.
3. Configuration, workflow, lockfile, and GitHub API evidence.
4. Live read-only output from the official domain.
5. Official provider/competitor/research source.
6. Inference or hypothesis, clearly labelled for validation.

Where code, documentation, and product copy disagree, the audit records the disagreement rather than choosing the most
favorable interpretation.

## Risk method

- P0: active integrity, privacy, security, or delivery failure requiring feature-release stop.
- P1: material customer, revenue, or operational risk that blocks paid growth.
- P2: significant scale, maintainability, or product-trust risk for the next 90 days.
- P3: strategic option requiring validation before major investment.

Likelihood is directional because production incident and cohort data were unavailable. Risk closure requires a
production-path test, observable invariant, rollout/rollback evidence, owner, target, and release-SHA verification.

## Limitations

The review did not access production Appwrite data/permissions/logs, Stripe Dashboard, AI provider billing/configuration,
Vercel analytics, legal agreements, user research, support history, or financial statements. It is not a penetration
test, legal/compliance certification, financial forecast, accessibility conformance report, or causal learning study.

The initial audit changed no application code, production data, external settings, prices, or deployed systems. Later
delivery work follows separate reviewed branches and PRs; its evidence belongs in [Delivery Traceability](./TRACEABILITY.md).
