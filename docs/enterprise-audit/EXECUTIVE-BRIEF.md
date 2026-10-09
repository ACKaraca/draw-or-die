# Executive Brief

## Verdict

Draw or Die has a distinctive premise, a visually recognizable identity, centralized economy pricing, structured AI
outputs, and the beginnings of a real product ecosystem. It is not yet safe to operate as a company-grade paid product
from the audited source snapshot.

The first objective is not feature velocity. It is restoring a trustworthy delivery baseline and protecting identity,
money, user files, and entitlement state. Once those controls are green, the strongest product opportunity is to own the
loop between critiques: **upload → understand → revise → compare → improve**. Harshness is an acquisition hook;
measurable revision progress is the retention and pricing engine.

## Stop-the-line findings

1. `origin/main` contains unresolved Git conflict markers in the core AI route and cannot pass TypeScript or build gates.
2. GitHub requires one approving review but no successful status checks; administrator bypass, force-push, and branch
   deletion remain allowed, and `dev-main` has weaker conversation/history controls than `main`.
3. Some non-premium analyses can be written as auto-approved gallery content without explicit publish consent.
4. Guest conversion can fail silently while the interface and Checkout treat the anonymous identity as durable.
5. The education verification code can be exposed through the authenticated profile response, allowing mailbox proof to
   be bypassed.
6. Anonymous or unverified identities can receive rewards intended for verified registered users.
7. Rapido balance updates use non-atomic read/modify/write flows; concurrent requests can overspend or lose credits.
8. Stripe events are recorded as processed before their business effect succeeds, so retries can be suppressed after a
   partial failure.
9. Shared Appwrite storage permissions allow overly broad authenticated-user mutation of files.
10. The repository default AI model is a retired preview identifier; the live environment override is unknown.

No pricing campaign, referral expansion, or paid acquisition should be scaled before items 1–10 have controlled fixes.

## Company-level priorities

### Priority 0 — Establish truth and control

- Freeze feature merges until a reproducible build is restored.
- Reconcile the existing divergent `dev-main` history with the verified source baseline and harden both long-lived branches.
- Require lint, typecheck, unit/integration tests, build, dependency policy, secret scan, and smoke checks.
- Introduce an explicit incident owner, rollback path, and daily reconciliation for money and entitlements.

### Priority 1 — Make paid value trustworthy

- Replace the mutable Rapido counter with an append-only ledger and idempotent reservation/settlement workflow.
- Reconcile Stripe payments, renewals, cancellations, promotions, and premium allowance periods from durable event state.
- Separate purchased credits, subscription allowance, earned grants, and expiring promotions.
- Add cost telemetry before changing prices: model, token/image usage, provider cost, retries, refunds, and contribution
  margin per operation.

### Priority 2 — Build the revision product

- Turn every critique into a prioritized action plan with issue state, evidence, and confidence.
- Let users upload the next version and compare resolved, regressed, and newly detected issues.
- Make progress history and a shareable before/after artifact the retention and organic-growth mechanisms.
- Clearly label AI critique as advisory; never frame accessibility, egress, structural, or regulatory feedback as approval.

### Priority 3 — Validate monetization before platform expansion

- Clarify the free, registered, premium, and purchased-credit contracts.
- Test time-bound Crit Week and Portfolio Season outcome packs after unit economics are visible.
- Validate a private Friends Team offer—one owner plus up to five invited members, shared projects, and a separate
  pooled Rapido account—only after revision, storage, privacy, and ledger controls pass.
- Sell an education studio pilot through a separately isolated cohort boundary/ledger before building reusable tenancy.
- Require D-027 evidence from two paid pilots plus a paid renewal/expansion before investing in institution tenancy,
  cohort, role, reporting, recovery, or organization billing branches.

## Twelve-month outcome thesis

| Horizon | Required outcome | Exit evidence |
|---|---|---|
| 0–14 days | P0 exposure contained and critical hotfixes live | Green protected main, restrictive holds, verified rollback, P0 tests |
| 15–45 days | P0 remediations plus correct money, entitlements, files, and AI lifecycle | Zero unexplained drift; supported model; historical consent decision |
| 46–90 days | Measurable revision loop | Cohort lift in critique-to-revision completion and retained use |
| 3–6 months | Validated individual and Friends Team packaging | Positive contribution margin and paid conversion by segment |
| 6–12 months | Evidence-backed education offer | Two reconciled paid pilots and at least one paid renewal/expansion |

## Investment rule

Every roadmap item must improve at least one of these outcomes without materially degrading another:

- trust and safety;
- critique-to-revision completion;
- paid conversion or contribution margin;
- retained learning progress;
- educator or portfolio outcome value;
- operating reliability and recovery time.

Feature count, raw sign-ups, generated critiques, and Rapido issued are diagnostic metrics, not company outcomes.

## Explicit non-goals

- Do not market the product as replacing an architect, educator, code reviewer, or licensed professional.
- Do not build the full ArchBuilder platform until its API contract and demand are validated.
- Do not increase promotional credit emission before the ledger and abuse controls exist.
- Do not change prices from competitor screenshots alone.
- Do not launch institution-wide data collection before privacy, retention, export, deletion, and role controls are defined.
