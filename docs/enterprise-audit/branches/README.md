# Branch Delivery Portfolio

Each of the 52 directories below represents one proposed Git branch and contains a complete branch-level delivery
contract. These branches do not exist yet. The plans are ordered by dependency and risk, not by feature excitement.

## Base-branch rule

The initial checkout falsely appeared to lack `dev-main` because its fetch refspec exposed only `main`. Direct remote
verification found `dev-main` at `8869af1`: its tree matched audited `main`, while its history had diverged. Reconcile
through reviewed normal history—never force-reset—then branch standard work from protected, green `dev-main`. An
explicitly approved production hotfix may branch from `main` only when its release boundary requires it.

Do not create all branches at once. Create a branch when its dependencies and phase exit gate are satisfied.

## Portfolio

| # | Proposed branch | P | Phase | Mode | Plan |
|---:|---|---:|---:|---|---|
| 00 | `fix/release-build-blockers` | P0 | 0 | Critical path | [Plan](./00-fix-release-build-blockers/README.md) |
| 02A | `fix/p0-capability-containment` | P0 | 0 | Containment | [Plan](./02a-fix-p0-capability-containment/README.md) |
| 35A | `docs/education-market-discovery` | P2 | 0 | Parallel discovery | [Plan](./35a-docs-education-market-discovery/README.md) |
| 35B | `docs/education-discovery-evidence` | P2 | 0 | Evidence gate | [Plan](./35b-docs-education-discovery-evidence/README.md) |
| 01 | `fix/repository-release-gates` | P0 | 0 | Critical path | [Plan](./01-fix-repository-release-gates/README.md) |
| 37 | `chore/enterprise-audit-validation` | P1 | 0 | Documentation integrity | [Plan](./37-chore-enterprise-audit-validation/README.md) |
| 02 | `fix/staging-artifact-promotion` | P0 | 0 | Critical path | [Plan](./02-fix-staging-artifact-promotion/README.md) |
| 03 | `fix/explicit-gallery-consent` | P0 | 1 | Critical path | [Plan](./03-fix-explicit-gallery-consent/README.md) |
| 03A | `fix/historical-gallery-remediation` | P0 | 1 | Decision-gated closure | [Plan](./03a-fix-historical-gallery-remediation/README.md) |
| 04 | `fix/security-edu-otp-secrecy` | P0 | 1 | Critical path | [Plan](./04-fix-security-edu-otp-secrecy/README.md) |
| 05 | `fix/guest-account-conversion` | P0 | 1 | Critical path | [Plan](./05-fix-guest-account-conversion/README.md) |
| 06 | `fix/security-verified-identity-rewards` | P0 | 1 | Critical path | [Plan](./06-fix-security-verified-identity-rewards/README.md) |
| 07 | `fix/ai-model-lifecycle` | P0 | 1 | Critical path | [Plan](./07-fix-ai-model-lifecycle/README.md) |
| 31A | `fix/search-identity` | P1 | 1 | Parallel foundation | [Plan](./31a-fix-search-identity/README.md) |
| 08 | `refactor/versioned-appwrite-migrations` | P1 | 2 | Standard | [Plan](./08-refactor-versioned-appwrite-migrations/README.md) |
| 09 | `feat/server-enforced-kill-switches` | P1 | 2 | Standard | [Plan](./09-feat-server-enforced-kill-switches/README.md) |
| 10 | `chore/critical-contract-harness` | P1 | 2 | Standard | [Plan](./10-chore-critical-contract-harness/README.md) |
| 11 | `chore/security-runtime-dependencies` | P1 | 2 | Standard | [Plan](./11-chore-security-runtime-dependencies/README.md) |
| 12 | `fix/http-security-boundaries` | P1 | 2 | Standard | [Plan](./12-fix-http-security-boundaries/README.md) |
| 13 | `feat/operational-observability` | P1 | 2 | Standard | [Plan](./13-feat-operational-observability/README.md) |
| 14 | `docs/incident-dr-release-runbooks` | P1 | 2 | Standard | [Plan](./14-docs-incident-dr-release-runbooks/README.md) |
| 15 | `fix/atomic-rapido-ledger` | P0 | 3 | Critical path | [Plan](./15-fix-atomic-rapido-ledger/README.md) |
| 16 | `fix/stripe-webhook-idempotency` | P0 | 3 | Critical path | [Plan](./16-fix-stripe-webhook-idempotency/README.md) |
| 17 | `fix/stripe-entitlement-reconciliation` | P1 | 3 | Standard | [Plan](./17-fix-stripe-entitlement-reconciliation/README.md) |
| 18 | `fix/security-storage-tenant-isolation` | P0 | 3 | Critical path | [Plan](./18-fix-security-storage-tenant-isolation/README.md) |
| 19 | `fix/privacy-data-lifecycle` | P1 | 3 | Standard | [Plan](./19-fix-privacy-data-lifecycle/README.md) |
| 20 | `feat/product-funnel-instrumentation` | P1 | 4 | Standard | [Plan](./20-feat-product-funnel-instrumentation/README.md) |
| 21 | `fix/ai-request-lifecycle` | P1 | 4 | Standard | [Plan](./21-fix-ai-request-lifecycle/README.md) |
| 22 | `refactor/ai-operation-registry` | P1 | 4 | Standard | [Plan](./22-refactor-ai-operation-registry/README.md) |
| 23 | `chore/ai-evaluation-gates` | P1 | 4 | Standard | [Plan](./23-chore-ai-evaluation-gates/README.md) |
| 24 | `fix/ai-memory-cache-semantics` | P1 | 4 | Standard | [Plan](./24-fix-ai-memory-cache-semantics/README.md) |
| 25 | `fix/ai-moderation-boundaries` | P1 | 4 | Standard | [Plan](./25-fix-ai-moderation-boundaries/README.md) |
| 34 | `feat/ai-trust-disclosure` | P1 | 4 | Standard | [Plan](./34-feat-ai-trust-disclosure/README.md) |
| 26 | `refactor/typed-analysis-state-machine` | P2 | 5 | Standard | [Plan](./26-refactor-typed-analysis-state-machine/README.md) |
| 27 | `fix/revision-continuity` | P1 | 5 | Standard | [Plan](./27-fix-revision-continuity/README.md) |
| 28 | `fix/core-flow-accessibility` | P1 | 5 | Standard | [Plan](./28-fix-core-flow-accessibility/README.md) |
| 29 | `feat/revision-learning-loop` | P1 | 5 | Standard | [Plan](./29-feat-revision-learning-loop/README.md) |
| 30 | `refactor/app-router-boundaries` | P2 | 5 | Optional | [Plan](./30-refactor-app-router-boundaries/README.md) |
| 31 | `fix/acquisition-foundation` | P1 | 6 | Standard | [Plan](./31-fix-acquisition-foundation/README.md) |
| 32 | `feat/premium-packaging` | P2 | 6 | Standard | [Plan](./32-feat-premium-packaging/README.md) |
| 32A | `feat/private-team-workspace` | P2 | 6 | Optional team track | [Plan](./32a-feat-private-team-workspace/README.md) |
| 32B | `feat/shared-team-rapido-pool` | P1 | 6 | Optional financial gate | [Plan](./32b-feat-shared-team-rapido-pool/README.md) |
| 32C | `feat/team-packaging` | P2 | 6 | Optional team track | [Plan](./32c-feat-team-packaging/README.md) |
| 33 | `feat/portfolio-season` | P2 | 6 | Standard | [Plan](./33-feat-portfolio-season/README.md) |
| 35 | `docs/education-studio-pilot` | P2 | 7 | Evidence-gated | [Plan](./35-docs-education-studio-pilot/README.md) |
| 35D | `feat/education-pilot-cohort-controls` | P1 | 7 | Enrollment/financial gate | [Plan](./35d-feat-education-pilot-cohort-controls/README.md) |
| 35C | `docs/education-pilot-evidence` | P2 | 7 | Evidence gate | [Plan](./35c-docs-education-pilot-evidence/README.md) |
| 36 | `feat/institution-foundation` | P3 | 8 | Evidence-gated | [Plan](./36-feat-institution-foundation/README.md) |
| 36A | `feat/institution-cohort-roster` | P3 | 8 | Evidence-gated | [Plan](./36a-feat-institution-cohort-roster/README.md) |
| 36B | `feat/institution-billing-rapido` | P2 | 8 | Financial gate | [Plan](./36b-feat-institution-billing-rapido/README.md) |
| 36C | `feat/institution-educator-reporting` | P3 | 8 | Evidence-gated | [Plan](./36c-feat-institution-educator-reporting/README.md) |
| 36D | `feat/institution-recovery-offboarding` | P2 | 8 | General-availability gate | [Plan](./36d-feat-institution-recovery-offboarding/README.md) |

## Critical dependency graph

```mermaid
flowchart LR
  b00["00 build"]
  b01["01 branch gates"]
  b37["37 audit validation"]
  b02["02 artifact promotion"]
  b02a["02A containment hotfix"]
  b03["03 publish consent"]
  b03a["03A historical remediation"]
  b04["04 OTP secrecy"]
  b05["05 guest conversion"]
  b06["06 verified rewards"]
  b07["07 model lifecycle"]
  b08["08 migrations"]
  b09["09 kill switches"]
  b10["10 contract harness"]
  b11["11 dependencies"]
  b12["12 HTTP boundaries"]
  b13["13 observability"]
  b14["14 runbooks"]
  b15["15 Rapido ledger"]
  b16["16 Stripe event state"]
  b17["17 entitlements"]
  b18["18 storage isolation"]
  b19["19 privacy orchestration"]
  b20["20 product events"]
  b21["21 AI request lifecycle"]
  b22["22 AI registry"]
  b23["23 AI eval gates"]
  b24["24 AI memory/cache"]
  b25["25 moderation"]
  b26["26 typed UI state"]
  b27["27 revision continuity"]
  b28["28 accessibility"]
  b29["29 revision loop"]
  b30["30 routes (optional)"]
  b31a["31A search identity"]
  b31["31 acquisition"]
  b32["32 premium packaging"]
  b32a["32A private team workspace"]
  b32b["32B shared Team Rapido"]
  b32c["32C Team packaging"]
  b33["33 portfolio season"]
  b34["34 AI disclosure"]
  b35a["35A discovery protocol"]
  discoveryOps["Approved discovery operations"]
  b35b["35B discovery evidence"]
  b35["35 pilot protocol"]
  b35d["35D pilot cohort controls"]
  pilotOps["Two paid pilot operations"]
  b35c["35C pilot evidence"]
  b36["36 institution foundation"]
  b36a["36A cohort and roster"]
  b36b["36B institution billing"]
  b36c["36C educator reporting"]
  b36d["36D recovery and offboarding"]

  b00 --> b01
  b00 --> b37
  b01 --> b02
  b00 --> b02a
  b00 --> b03
  b01 --> b03
  b02a --> b03
  b03 --> b03a
  b00 --> b04
  b01 --> b04
  b02a --> b04
  b00 --> b05
  b01 --> b05
  b02a --> b05
  b04 --> b06
  b05 --> b06
  b00 --> b07
  b01 --> b07
  b02a --> b07
  b02 --> b08
  b02 --> b09
  b00 --> b10
  b01 --> b10
  b00 --> b11
  b10 --> b11
  b02 --> b12
  b02 --> b13
  b02 --> b14
  b13 --> b14
  b08 --> b15
  b09 --> b15
  b10 --> b15
  b13 --> b15
  b06 --> b15
  b15 --> b16
  b13 --> b16
  b16 --> b17
  b15 --> b17
  b03 --> b18
  b08 --> b18
  b10 --> b18
  b18 --> b19
  b08 --> b19
  b19 --> b20
  b13 --> b20
  b05 --> b20
  b07 --> b21
  b15 --> b21
  b13 --> b21
  b07 --> b22
  b21 --> b22
  b08 --> b22
  b10 --> b22
  b22 --> b23
  b19 --> b24
  b22 --> b24
  b08 --> b24
  b03 --> b25
  b09 --> b25
  b22 --> b25
  b18 --> b27
  b20 --> b27
  b10 --> b27
  b27 --> b26
  b10 --> b26
  b10 --> b28
  b22 --> b29
  b27 --> b29
  b15 --> b29
  b20 --> b29
  b26 --> b29
  b28 --> b29
  b26 --> b30
  b10 --> b30
  b00 --> b31a
  b01 --> b31a
  b31a --> b31
  b03 --> b31
  b20 --> b31
  b17 --> b32
  b15 --> b32
  b20 --> b32
  b29 --> b32
  b05 --> b32a
  b18 --> b32a
  b19 --> b32a
  b29 --> b32a
  b28 --> b32a
  b12 --> b32a
  b14 --> b32a
  b34 --> b32a
  b32a --> b32b
  b15 --> b32b
  b09 --> b32b
  b13 --> b32b
  b32a --> b32c
  b32b --> b32c
  b32 --> b32c
  b17 --> b32c
  b20 --> b32c
  b29 --> b33
  b18 --> b33
  b19 --> b33
  b32 --> b33
  b28 --> b33
  b19 --> b34
  b24 --> b34
  b25 --> b34
  b35a --> b35b
  b35a --> discoveryOps
  discoveryOps --> b35b
  b35b --> b35
  b29 --> b35
  b19 --> b35
  b34 --> b35
  b14 --> b35
  b35 --> b35d
  b08 --> b35d
  b15 --> b35d
  b18 --> b35d
  b19 --> b35d
  b10 --> b35d
  b14 --> b35d
  b13 --> b35d
  b35 --> b35c
  b35d --> b35c
  b35d --> pilotOps
  pilotOps --> b35c
  b35c --> b36
  b08 --> b36
  b18 --> b36
  b19 --> b36
  b10 --> b36
  b14 --> b36
  b36 --> b36a
  b29 --> b36a
  b34 --> b36a
  b28 --> b36a
  b36a --> b36b
  b15 --> b36b
  b17 --> b36b
  b13 --> b36b
  b08 --> b36b
  b36a --> b36c
  b20 --> b36c
  b19 --> b36c
  b34 --> b36c
  b36 --> b36d
  b36a --> b36d
  b36b --> b36d
  b36c --> b36d
  b14 --> b36d
```

The `Depends on` field in each branch plan is normative. This diagram includes every branch-to-branch hard dependency;
decision IDs and owner approvals remain in branch metadata. Automated validation must reject a missing target or cycle.

## Global branch rules

- A branch with an unassigned DRI/approver or unset target must not start.
- One branch owns one rollback boundary. No hidden cleanup or unrelated refactor.
- All schema, wallet, storage, historical-publication, and irreversible deletion actions require explicit owner approval.
- Rollbacks are new commits/PRs; never erase history with force-push or reset.
- A security rollback cannot restore plaintext OTP, automatic publication, retired AI models, or client-owned authority.
- Every PR links production-path tests, rollout evidence, metrics, and rollback instructions.
- The phase exit gate wins over calendar dates.
