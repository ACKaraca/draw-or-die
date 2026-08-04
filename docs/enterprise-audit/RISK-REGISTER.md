# Enterprise Risk Register

## Rating model

| Priority | Meaning | Release policy |
|---|---|---|
| P0 | Active integrity, privacy, security, or delivery failure | Stop feature releases; fix and verify immediately |
| P1 | Material customer, revenue, or operational risk | Close before paid growth or broader launch |
| P2 | Significant scale, maintainability, or product-trust risk | Plan within the next 90 days |
| P3 | Strategic limitation or future concentration risk | Validate before committing major investment |

Likelihood is a directional assessment from repository evidence, not production incident frequency. “Open” means the
control was not demonstrated in the audited snapshot.

Control states are evidence-based: `Open` has no verified live control; `Contained` has a temporary restrictive hold
with an owner and review date; `Controlled` has passed the permanent branch closure evidence; `Accepted` has a
time-bounded decision-log record and expiry. Planning a control does not change its state.

## Register

| ID | P | Risk and business consequence | Likelihood | Primary evidence | Permanent control / branch | Status |
|---|---:|---|---|---|---|---|
| R-001 | P0 | `main` cannot build, blocking reproducible production releases and security analysis | Certain on audited `main`; remediated on `dev-main` | Audited conflict markers/failures; PR #49 passed all gates and merged as `69f6578`, but `main` was not promoted | `fix/release-build-blockers` plus approved production release | Open — `dev-main` repaired; production evidence pending |
| R-002 | P0 | Failed or insufficiently controlled code can reach long-lived branches | High | One review but no required status checks; admin bypass, force-push, and deletion allowed | `fix/repository-release-gates` | Open |
| R-003 | P0 | Free analysis can become an auto-approved gallery record without explicit consent | High | Upload privacy promise conflicts with analysis and gallery flows | `fix/explicit-gallery-consent` plus `fix/historical-gallery-remediation` | Open |
| R-004 | P0 | Education mailbox ownership can be bypassed by reading the OTP from the profile response | High | OTP stored in profile and broad profile DTO | `fix/security-edu-otp-secrecy` | Open |
| R-005 | P0 | Guest account conversion can fail silently while UI and checkout treat the user as registered | High | Conversion error is swallowed; modal closes; checkout accepts anon identity | `fix/guest-account-conversion` | Open |
| R-006 | P0 | Concurrent AI operations can overspend or lose Rapido value | High | Non-atomic balance read and absolute update | `fix/atomic-rapido-ledger` | Open |
| R-007 | P0 | Stripe retry can be suppressed after partial business failure | High | Event recorded before entitlement or credit side effect completes | `fix/stripe-webhook-idempotency` | Open |
| R-008 | P0 | Unverified or anonymous identities can farm registration and referral value | High | Verified-email state not enforced for reward eligibility | `fix/security-verified-identity-rewards` | Open |
| R-009 | P0 | Authenticated users can mutate files outside their intended tenant boundary | High | Shared bucket permissions and `fileSecurity: false` | `fix/security-storage-tenant-isolation` | Open |
| R-010 | P1 | Gallery moderation and approval state can be influenced by client input | High | `autoApproved` crosses the trust boundary | `fix/explicit-gallery-consent` | Open |
| R-011 | P1 | Client-controlled history mode can bypass expected entitlement or storage policy | Medium | `preserveMode` accepted without server-owned policy | `fix/atomic-rapido-ledger` and entitlement policy | Open |
| R-012 | P1 | Anonymous confession upload can be abused or persist unsafe content | High | Fail-open moderation, broad upload path, weak content controls | Kill switch, then `fix/ai-moderation-boundaries` | Open |
| R-013 | P1 | Internal promotion quotas can be bypassed or misapplied in Stripe Checkout | Medium | Unconsumed quota and ambiguous internal-versus-Stripe promo IDs | `fix/stripe-entitlement-reconciliation` | Open |
| R-014 | P1 | Premium renewal, expiry, and included Rapido are contractually inconsistent | High | Initial checkout grant without complete renewal reconciliation | `fix/stripe-entitlement-reconciliation` | Open |
| R-015 | P1 | Production dependency vulnerabilities remain non-blocking | High | 9 high and 6 moderate production audit findings | `chore/security-runtime-dependencies` | Open |
| R-016 | P1 | Request-time schema mutation can race, drift, or fail under user traffic | High | Runtime Appwrite resource bootstrap using admin credentials | `refactor/versioned-appwrite-migrations` | Open |
| R-017 | P0 | Repository default AI model is retired and may be unavailable | High | Retired preview identifier is the source default; live override unknown | `fix/ai-model-lifecycle` | Open |
| R-018 | P1 | AI requests can continue after timeout, amplify cost, or accept unsafe/unbounded output | Medium | Client timeout without downstream abort; incomplete output controls | `fix/ai-request-lifecycle` | Open |
| R-019 | P1 | Deleted AI memory can still influence later responses | High | Soft-delete state is not honored consistently by the AI load path | `fix/privacy-data-lifecycle`, then cache semantics | Open |
| R-020 | P1 | Tests can pass without exercising production authorization, billing, and route code | High | Copied helpers, API routes excluded, 2 route tests for 35 routes | `chore/critical-contract-harness` | Open |
| R-021 | P1 | Incidents cannot be detected, attributed, or recovered within a defined target | High | No service SLOs, central traces, alerts, tested DR, or release SHA health | `feat/operational-observability` | Open |
| R-022 | P1 | Feature-flag dependency failures can enable costly or abusable behavior | Medium | Several controls fail open | `feat/server-enforced-kill-switches` | Open |
| R-023 | P1 | Conversion and attribution decisions are based on missing or contradictory events | Certain | Conversion API discards valid payloads; checkout does not carry expected UTM | `feat/product-funnel-instrumentation` | Open |
| R-024 | P1 | Search equity and analytics are split across stale and development domains | High | Legacy canonical/sitemap; development indexable; shared GA defaults | `fix/search-identity` | Open |
| R-025 | P1 | Billing reports mix currencies and grants, producing misleading revenue signals | High | TRY/USD aggregation and non-purchase grants counted together | `feat/operational-observability` | Open |
| R-026 | P2 | Core AI, analysis hook, portfolio UI, and store modules have excessive blast radius | High | Multi-thousand-line modules with mixed responsibilities | `refactor/ai-operation-registry` | Open |
| R-027 | P2 | UI state permits impossible transitions and difficult recovery | Medium | String-based pseudo-state-machine in a broad persisted store | `refactor/typed-analysis-state-machine` | Open |
| R-028 | P2 | A client-heavy root shell weakens routing, discoverability, performance, and isolation | High | Core screens orchestrated as a client SPA | `refactor/app-router-boundaries` | Open |
| R-029 | P2 | Privacy, retention, export, deletion, AI disclosure, and analytics consent are incomplete | High | Thin policy surface and inconsistent data lifecycle behavior | `fix/privacy-data-lifecycle` | Open |
| R-030 | P2 | Product value ends at critique generation instead of demonstrated improvement | High | No first-class issue-resolution and version-comparison loop | `feat/revision-learning-loop` | Open |
| R-031 | P2 | Existing plans, UI costs, and canonical pricing rules disagree | High | AUTO_CONCEPT, mentor, guest, and preservation contract drift | `feat/premium-packaging` | Open |
| R-032 | P2 | Technical and operational documents can mislead implementation | High | Architecture still references Supabase and stale deployment flows | `docs/incident-dr-release-runbooks` | Open |
| R-033 | P3 | Building an institution platform before paid-pilot evidence can consume runway | Medium | Broad education opportunity but no demonstrated sales evidence | `docs/education-market-discovery` → `docs/education-discovery-evidence` → `docs/education-studio-pilot` → `docs/education-pilot-evidence` | Open |
| R-034 | P3 | ArchBuilder can be marketed before its route/API contract is functional | High | UI references absent API routes and incomplete feature boundaries | Separate validation decision; no launch branch yet | Open |
| R-035 | P1 | Most AI operations can accept syntactically or semantically invalid output | High | Only four operations pass strict provider schemas; broad casts/fallback filler | `refactor/ai-operation-registry` | Open |
| R-036 | P1 | File-summary cache can replace source images across incompatible operations | High | Cache key omits operation/model/prompt/schema and drops the image | `fix/ai-memory-cache-semantics` | Open |
| R-037 | P1 | Team invites or project permissions can expose one user/team's private work to another | High | No team/membership/share authorization model exists | `feat/private-team-workspace` | Open |
| R-038 | P1 | Shared Team Rapido can overspend, charge a personal wallet, or lose value during member/concurrency changes | High | No team ledger account, authority snapshot, limit, or reconciliation contract exists | `feat/shared-team-rapido-pool` | Open |
| R-039 | P2 | Friends Team and school pricing/data contracts can be conflated, causing margin, consent, and support failures | Medium | New offers have different users, value pools, privacy duties, and procurement paths | `feat/team-packaging` plus education protocol/evidence branches | Open |
| R-040 | P1 | A paid education pilot can mix schools or grant institution value without an authoritative cohort ledger | High | Pilot contract requires cohort Rapido while Team excludes schools and institution billing is post-pilot | `feat/education-pilot-cohort-controls` | Open |
| R-041 | P2 | Institution tenancy, cohort, billing, reporting, and recovery can become one unsafe rollback boundary | High | Earlier XXL foundation plan combined five independently failing domains | Split institution branches 36–36D | Open |
| R-042 | P1 | Team entitlements or remaining purchased value can be stranded, erased, double-refunded, or unlock personal Premium | High | Team operation allowlist and closure liability were undefined | `feat/shared-team-rapido-pool` plus `feat/team-packaging` | Open |
| R-043 | P1 | Educator access can expose learner-owned work or become unlogged grading/surveillance | High | Individual artifact ownership, assignment authority, and portability require an explicit contract | D-028 plus cohort/reporting branches | Open |
| R-044 | P1 | Organization administration, billing, educator, learner, and support privileges can be conflated | High | Institution role and billing authority are not implemented | `feat/institution-foundation` plus `feat/institution-billing-rapido` | Open |
| R-045 | P1 | Planning links, decisions, counts, or dependency DAG can drift and merge without any CI signal | Certain | Documentation paths are excluded from PR gates and no repository validator exists | `chore/enterprise-audit-validation` | Open |

## P0 containment overlay

The [P0 containment runbook](./P0-CONTAINMENT-RUNBOOK.md) owns immediate operator holds, and
`fix/p0-capability-containment` owns their server enforcement. Every row remains `Open` until live verification proves
the named hold is active and all ownership/review fields are resolved.

| Risk | Restrictive containment | Hold owner | Start | Review | Re-enable gate | State |
|---|---|---|---|---|---|---|
| R-003 | Disable writes and non-consent-proven historical delivery | UNASSIGNED | NOT STARTED | UNSET | Consent branch plus historical decision | Open |
| R-004 | Disable education verification; remove DTO secret fields; invalidate legacy codes | UNASSIGNED | NOT STARTED | UNSET | OTP-secrecy acceptance | Open |
| R-005 | Disable guest Checkout and unsafe conversion claims | UNASSIGNED | NOT STARTED | UNSET | Guest-conversion acceptance | Open |
| R-006 | Disable paid AI without a safe wallet path | UNASSIGNED | NOT STARTED | UNSET | Atomic-ledger acceptance | Open |
| R-007 | Pause effects, retain signed events, and disable all new Checkout | UNASSIGNED | NOT STARTED | UNSET | Webhook replay/reconciliation acceptance | Open |
| R-008 | Disable new reward grants | UNASSIGNED | NOT STARTED | UNSET | Verified-reward acceptance | Open |
| R-009 | Block broad direct client storage mutation | UNASSIGNED | NOT STARTED | UNSET | Tenant-storage acceptance | Open |
| R-017 | Disable paid AI on unsupported or unverified model policy | UNASSIGNED | NOT STARTED | UNSET | Model-lifecycle acceptance | Open |

All evidence in this register was last reviewed on 2026-08-04 unless a later review date is recorded. Target residual
risk for P0/P1 controls is Low; accepted Medium residual risk requires a time-bounded decision-log entry.

## Accountability and target window

| Risk group | Accountable role | Target window | Independent evidence owner |
|---|---|---|---|
| R-001–R-002 | Release engineering | Phase 0 | QA/SRE reviewer |
| R-003–R-005, R-008–R-012 | Product + security | Phases 1–3 | Privacy/security reviewer |
| R-006–R-007, R-013–R-014, R-025 | Commerce engineering | Phase 3 | Finance/commerce reviewer |
| R-015–R-016, R-020–R-022, R-032 | Platform engineering | Phases 2–3 | QA/SRE reviewer |
| R-017–R-019, R-035–R-036 | AI engineering | Phases 1–4 | AI quality + privacy reviewer |
| R-023 | Growth engineering | Phase 4 | Product analytics reviewer |
| R-024 | Growth/platform engineering | Phase 1 | SEO/privacy reviewer |
| R-026–R-031 | Product engineering | Phases 4–6 | Product/UX reviewer |
| R-033–R-034 | Product leadership | Discovery gate | Budget holder + product owner |
| R-037–R-039 | Team product + commerce/security | Phase 6 | Finance + privacy/security reviewer |
| R-040, R-043 | Education operations + privacy/security | Phase 7 | Finance + learner-data reviewer |
| R-041, R-044 | Institution platform + product | Phase 8 | Security/privacy + finance reviewer |
| R-042 | Team product + commerce | Phase 6 | Finance + security reviewer |
| R-045 | Release/documentation engineering | Phase 0 | QA/repository reviewer |

## Closure evidence required

A risk can move to “Controlled” only when all applicable evidence exists:

1. a production-path automated test;
2. an observable invariant or reconciliation query;
3. a rollout and rollback record;
4. an accountable owner and target date;
5. a user-facing contract or policy update when behavior changes;
6. a post-deploy verification against the exact release SHA.

Risk acceptance must be explicit, time-bounded, and recorded in the decision log. Silence is not acceptance.
