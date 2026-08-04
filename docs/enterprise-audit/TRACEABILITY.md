# Delivery Traceability Register

## Purpose

This register joins each proposed branch to its controlling risks and decisions and records whether delivery evidence
exists. The branch plan remains authoritative for scope/dependencies; the risk and decision registers remain
authoritative for control/approval semantics.

Except for branch 00, no planned feature branch is implied to exist. `Planned / unset` means DRI, target, PR, merge
SHA, rollout, rollback, and post-deploy verification are all absent. A future branch may move forward only when its
plan metadata, hard dependencies, decision gates, and approvals permit it.

## Lifecycle evidence contract

| State | Minimum evidence |
|---|---|
| Planned | Separate plan folder, indexed branch, valid dependencies, risk/decision mapping |
| Ready | Named DRI/approver, target date, all hard dependencies verified, decisions approved |
| PR open | PR URL/number, head SHA, required checks/review, rollout and rollback evidence |
| Merged | Base branch, immutable merge SHA/time, resolved review threads |
| Verified | Release SHA, acceptance evidence, reconciliation/monitoring, rollout and rollback proof |

## Branch register

| ID | Plan | Risk controls | Decision gates | Delivery state |
|---:|---|---|---|---|
| 00 | [`fix/release-build-blockers`](./branches/00-fix-release-build-blockers/README.md) | R-001 | D-001 | Merged to `dev-main`: [PR #49](https://github.com/ACKaraca/draw-or-die/pull/49), head `1b0292f`, merge `69f6578`; production not promoted |
| 02A | [`fix/p0-capability-containment`](./branches/02a-fix-p0-capability-containment/README.md) | R-003–R-009, R-017 | Incident/change approval | Planned / unset |
| 35A | [`docs/education-market-discovery`](./branches/35a-docs-education-market-discovery/README.md) | R-033 | D-019 | Planned / unset |
| 35B | [`docs/education-discovery-evidence`](./branches/35b-docs-education-discovery-evidence/README.md) | R-033 | D-019 | Planned / unset |
| 01 | [`fix/repository-release-gates`](./branches/01-fix-repository-release-gates/README.md) | R-002 | D-002 | Planned / unset |
| 37 | [`chore/enterprise-audit-validation`](./branches/37-chore-enterprise-audit-validation/README.md) | R-045 | D-002 | Planned / unset |
| 02 | [`fix/staging-artifact-promotion`](./branches/02-fix-staging-artifact-promotion/README.md) | R-021, R-032 | D-003 | Planned / unset |
| 03 | [`fix/explicit-gallery-consent`](./branches/03-fix-explicit-gallery-consent/README.md) | R-003, R-010 | D-005 | Planned / unset |
| 03A | [`fix/historical-gallery-remediation`](./branches/03a-fix-historical-gallery-remediation/README.md) | R-003 | D-004 | Planned / unset |
| 04 | [`fix/security-edu-otp-secrecy`](./branches/04-fix-security-edu-otp-secrecy/README.md) | R-004 | Branch/emergency approval | Planned / unset |
| 05 | [`fix/guest-account-conversion`](./branches/05-fix-guest-account-conversion/README.md) | R-005 | D-006 | Planned / unset |
| 06 | [`fix/security-verified-identity-rewards`](./branches/06-fix-security-verified-identity-rewards/README.md) | R-008 | D-007 | Planned / unset |
| 07 | [`fix/ai-model-lifecycle`](./branches/07-fix-ai-model-lifecycle/README.md) | R-017 | D-010 | Planned / unset |
| 31A | [`fix/search-identity`](./branches/31a-fix-search-identity/README.md) | R-024 | Domain/redirect approval | Planned / unset |
| 08 | [`refactor/versioned-appwrite-migrations`](./branches/08-refactor-versioned-appwrite-migrations/README.md) | R-016 | Per-migration approval | Planned / unset |
| 09 | [`feat/server-enforced-kill-switches`](./branches/09-feat-server-enforced-kill-switches/README.md) | R-022 | Branch approval | Planned / unset |
| 10 | [`chore/critical-contract-harness`](./branches/10-chore-critical-contract-harness/README.md) | R-020 | Branch approval | Planned / unset |
| 11 | [`chore/security-runtime-dependencies`](./branches/11-chore-security-runtime-dependencies/README.md) | R-015 | Branch/exception approval | Planned / unset |
| 12 | [`fix/http-security-boundaries`](./branches/12-fix-http-security-boundaries/README.md) | R-009, R-029 | Branch approval | Planned / unset |
| 13 | [`feat/operational-observability`](./branches/13-feat-operational-observability/README.md) | R-021, R-025 | D-015, D-017 | Planned / unset |
| 14 | [`docs/incident-dr-release-runbooks`](./branches/14-docs-incident-dr-release-runbooks/README.md) | R-021, R-032 | D-017, D-018 | Planned / unset |
| 15 | [`fix/atomic-rapido-ledger`](./branches/15-fix-atomic-rapido-ledger/README.md) | R-006, R-011 | D-008, D-014 | Planned / unset |
| 16 | [`fix/stripe-webhook-idempotency`](./branches/16-fix-stripe-webhook-idempotency/README.md) | R-007 | Incident/change approval | Planned / unset |
| 17 | [`fix/stripe-entitlement-reconciliation`](./branches/17-fix-stripe-entitlement-reconciliation/README.md) | R-013, R-014 | D-008, D-009 | Planned / unset |
| 18 | [`fix/security-storage-tenant-isolation`](./branches/18-fix-security-storage-tenant-isolation/README.md) | R-009 | Per-migration approval | Planned / unset |
| 19 | [`fix/privacy-data-lifecycle`](./branches/19-fix-privacy-data-lifecycle/README.md) | R-019, R-029 | D-011, D-016 | Planned / unset |
| 20 | [`feat/product-funnel-instrumentation`](./branches/20-feat-product-funnel-instrumentation/README.md) | R-023 | D-015 | Planned / unset |
| 21 | [`fix/ai-request-lifecycle`](./branches/21-fix-ai-request-lifecycle/README.md) | R-018 | D-010 | Planned / unset |
| 22 | [`refactor/ai-operation-registry`](./branches/22-refactor-ai-operation-registry/README.md) | R-026, R-035 | D-010 | Planned / unset |
| 23 | [`chore/ai-evaluation-gates`](./branches/23-chore-ai-evaluation-gates/README.md) | R-035 | D-010 | Planned / unset |
| 24 | [`fix/ai-memory-cache-semantics`](./branches/24-fix-ai-memory-cache-semantics/README.md) | R-019, R-036 | D-011 | Planned / unset |
| 25 | [`fix/ai-moderation-boundaries`](./branches/25-fix-ai-moderation-boundaries/README.md) | R-012 | D-005, D-021 | Planned / unset |
| 34 | [`feat/ai-trust-disclosure`](./branches/34-feat-ai-trust-disclosure/README.md) | R-029, R-035 | D-011 | Planned / unset |
| 26 | [`refactor/typed-analysis-state-machine`](./branches/26-refactor-typed-analysis-state-machine/README.md) | R-027 | D-013 | Planned / unset |
| 27 | [`fix/revision-continuity`](./branches/27-fix-revision-continuity/README.md) | R-030 | D-014 | Planned / unset |
| 28 | [`fix/core-flow-accessibility`](./branches/28-fix-core-flow-accessibility/README.md) | R-030 | Branch approval | Planned / unset |
| 29 | [`feat/revision-learning-loop`](./branches/29-feat-revision-learning-loop/README.md) | R-030 | D-013, D-014 | Planned / unset |
| 30 | [`refactor/app-router-boundaries`](./branches/30-refactor-app-router-boundaries/README.md) | R-028 | D-013 | Planned / unset |
| 31 | [`fix/acquisition-foundation`](./branches/31-fix-acquisition-foundation/README.md) | R-024, R-034 | D-012, D-020 | Planned / unset |
| 32 | [`feat/premium-packaging`](./branches/32-feat-premium-packaging/README.md) | R-014, R-031 | D-008, D-009, D-014 | Planned / unset |
| 32A | [`feat/private-team-workspace`](./branches/32a-feat-private-team-workspace/README.md) | R-037 | D-023 | Planned / unset |
| 32B | [`feat/shared-team-rapido-pool`](./branches/32b-feat-shared-team-rapido-pool/README.md) | R-038, R-042 | D-024, D-029 | Planned / unset |
| 32C | [`feat/team-packaging`](./branches/32c-feat-team-packaging/README.md) | R-039, R-042 | D-023–D-025, D-029 | Planned / unset |
| 33 | [`feat/portfolio-season`](./branches/33-feat-portfolio-season/README.md) | R-030, R-031 | D-014 | Planned / unset |
| 35 | [`docs/education-studio-pilot`](./branches/35-docs-education-studio-pilot/README.md) | R-033, R-039, R-040, R-043 | D-019, D-026–D-028, D-031 | Planned / unset |
| 35D | [`feat/education-pilot-cohort-controls`](./branches/35d-feat-education-pilot-cohort-controls/README.md) | R-040, R-043 | D-019, D-026–D-028, D-031 | Planned / unset |
| 35C | [`docs/education-pilot-evidence`](./branches/35c-docs-education-pilot-evidence/README.md) | R-033, R-040 | D-019, D-026–D-028, D-031 | Planned / unset |
| 36 | [`feat/institution-foundation`](./branches/36-feat-institution-foundation/README.md) | R-041, R-044 | D-019, D-027, D-028, D-030 | Planned / unset |
| 36A | [`feat/institution-cohort-roster`](./branches/36a-feat-institution-cohort-roster/README.md) | R-041, R-043, R-044 | D-027, D-028, D-030 | Planned / unset |
| 36B | [`feat/institution-billing-rapido`](./branches/36b-feat-institution-billing-rapido/README.md) | R-041, R-044 | D-026, D-027, D-030, D-032 | Planned / unset |
| 36C | [`feat/institution-educator-reporting`](./branches/36c-feat-institution-educator-reporting/README.md) | R-041, R-043 | D-027, D-028 | Planned / unset |
| 36D | [`feat/institution-recovery-offboarding`](./branches/36d-feat-institution-recovery-offboarding/README.md) | R-021, R-041 | D-016, D-018, D-027, D-032 | Planned / unset |

## Update rule

When a branch is created, update its plan and this row in the same PR. Record the branch, named DRI/approver, ISO target,
PR URL/number and head SHA. At merge, record base, merge SHA/time, and resolved review status. Mark `Verified` only after
acceptance, rollout, rollback, reconciliation/monitoring, and exact release-SHA evidence are linked. Never mark a risk
controlled merely because its plan or PR exists.
