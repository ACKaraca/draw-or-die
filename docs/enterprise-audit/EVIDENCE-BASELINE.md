# Evidence Baseline

## Reproducibility record

The audit used commit `73465a7` on 2026-08-04. The documentation work was isolated on
`docs/enterprise-product-audit`. The initial checkout exposed only `origin/main` because its configured fetch refspec
was limited to that branch. Direct remote-ref and GitHub API verification later found `dev-main` at `8869af1`. Its tree
matched `main` at the snapshot, but the histories had diverged by three `dev-main` commits and one `main` commit after
their common ancestor. The initial “missing branch” conclusion was a local-fetch false negative and is superseded here.

| Check | Observed result | Evidence |
|---|---|---|
| Conflict marker scan | Failed | `app/api/ai-generate/route.ts:784-802` |
| `npm run lint` | Failed | Parser error plus 125 warnings |
| `npm run typecheck` | Failed | Three `TS1185` merge-marker errors |
| `npm run test` | Failed | 22/37 suites passed; 15 failed; 149/150 tests passed |
| Production dependency audit | Failed policy target | 15 findings: 9 high, 6 moderate |
| Git working tree before audit docs | Clean | `git status --short` returned no changes |

Fourteen React-oriented test suites failed to load because the lockfile resolved React `19.2.7` and React DOM
`19.2.4`. One additional JSON code-fence parsing test failed independently. Dependency findings include vulnerable
production paths through Next.js, PostCSS, Sharp, Hono, and transitives. Reachability must be reviewed before upgrades;
major-version upgrades must not be applied blindly.

## Repository shape

| Measure | Observed value |
|---|---:|
| Tracked files | 249 |
| TypeScript / TSX files | 181 |
| API route files | 35 |
| Test files | 38 |
| Approximate application TypeScript | 36,400 lines |
| Direct API route test files | 2 |

Largest concentration points include:

- `app/api/ai-generate/route.ts` — approximately 3,922 lines;
- `hooks/useAnalysis.ts` — approximately 2,142 lines;
- `app/portfolio/page.tsx` — approximately 1,343 lines;
- `components/UploadStep.tsx` — approximately 1,203 lines;
- `lib/appwrite/resource-bootstrap.ts` — approximately 951 lines;
- `lib/appwrite/server.ts` — approximately 870 lines;
- `stores/drawOrDieStore.ts` — approximately 760 lines.

Size is not a defect by itself. Here it correlates with mixed authorization, billing, prompting, persistence, and UI
responsibilities, making changes harder to review and test independently.

## Delivery evidence

- CodeQL run `30883724250` failed while building at the unresolved conflict markers, so analysis did not complete.
- The latest eleven release workflow runs observed on 2026-08-04 were failures.
- `.github/workflows/release-gate.yml` triggers on pushes to `main` only for package, workflow, or script paths; ordinary
  application changes do not trigger it.
- Merge and release checks use Node 20 while production deployment uses Node 24.
- Production dependency audit steps are non-blocking.
- GitHub branch/rules verification showed one approving review for both long-lived branches but no required status
  checks. Administrator enforcement was disabled and force-push/deletion remained allowed. `main` required linear
  history and conversation resolution; `dev-main` did not.
- Documentation-only changes were excluded from both PR-check and CodeQL path filters, so the audit package had no
  automated link, metadata, decision-reference, or dependency-DAG gate.

## AI model lifecycle evidence

The repository default `google/gemini-3.1-flash-lite-preview` is retired. Google records a 2026-05-25 shutdown and
Vercel records provider removal on 2026-07-09. Production environment overrides were not available to the audit.
Sources accessed 2026-08-04:

- [Google Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations)
- [Vercel retired model page](https://vercel.com/ai-gateway/models/gemini-3.1-flash-lite-preview)

## Live-surface checks

Read-only checks on 2026-08-04 found both production and development roots and `/api/health` reachable. This does not
prove that the audited source can reproduce the deployed artifacts.

- Production and development returned different deployment identifiers.
- The public sitemap and robots output referenced the legacy `https://drawordie.ackaraca.me` domain.
- The live sitemap exposed only the legacy root URL.
- Canonical and Open Graph metadata also used the legacy domain.
- The development deployment was indexable rather than explicitly `noindex`.
- A single observed development cold response was slow; one sample is not a latency percentile.

## Positive foundations

- Strict TypeScript is configured.
- Rapido operation prices have a central source of truth.
- Many AI prompts request JSON, and four operations pass strict provider schemas.
- The core AI route validates an Appwrite JWT.
- Stripe webhook signatures are verified against the raw request.
- Several owner checks, rate-limit helpers, security tests, and CI workflows already exist.
- The design system and interactive redesign references are unusually concrete for a solo-built product.

These controls reduce remediation cost, but their presence must not be confused with end-to-end enforcement.

## Audit limitations

The following were not available and must be gathered before financial, legal, or growth decisions:

- production Appwrite collections, permissions, indexes, backups, and audit logs;
- Stripe products, prices, tax settings, disputes, refunds, webhook attempts, and customer records;
- production AI model environment overrides, token usage, latency, failure rate, and provider invoices;
- analytics warehouse, consent logs, attribution data, cohorts, support tickets, and research recordings;
- dependency exploitability analysis in the deployed runtime;
- legal review for privacy, consumer rights, education data, AI disclosures, and international sales.

## Evidence policy

Each implementation branch must convert its finding into an automated control. A code review statement such as
“validated,” “idempotent,” or “secure” is not closure without a production-path test, observable invariant, and rollback
procedure.
