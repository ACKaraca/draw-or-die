# Security and Privacy Program

## Security posture statement

The repository has meaningful controls—server-side AI authentication, Stripe signature verification, some owner checks,
structured validation, and security tests—but several production paths bypass the intended trust model. Security work
must focus first on verified exploitability and customer impact, not a broad rewrite or checklist count.

This document is an engineering threat model, not a penetration-test report or legal determination.

## Protected assets

- private drawings, PDFs, labels, prompts, critique, chat, and project history;
- identity, education email proof, anonymous-to-registered linkage, and account recovery;
- purchased, subscription, earned, and promotional Rapido value;
- friends-team membership, private shared projects, analysis history, spend authority, and pooled Rapido value;
- Stripe customer, subscription, invoice, refund, and entitlement state;
- public publishing consent, moderation state, reputation, and community safety;
- AI/provider credentials, Appwrite admin credentials, and webhook secrets;
- model output used for progression, public display, and educational decisions;
- operational logs, analytics identifiers, and experiment assignments.

## Threat actors and failure modes

- an anonymous actor farming registration, referral, peer, or promo value;
- an authenticated user crossing storage or document ownership boundaries;
- a user manipulating client-controlled approval, preservation, or entitlement flags;
- duplicate, delayed, out-of-order, or partially failed Stripe delivery;
- concurrent AI requests overspending a mutable balance;
- stolen/replayed invites, removed members retaining access, cross-team reads, or unauthorized shared-pool spend;
- malicious files or prompts targeting parsers, model instructions, logs, or downstream users;
- dependency compromise or leaked deployment credentials;
- accidental developer release, schema drift, or destructive migration;
- unintended publication, retention, or analytics collection;
- unsafe AI output being treated as professional or educational authority.

## P0 controls

### Explicit gallery consent

- No gallery database or storage write before a clear publish action.
- Remove client authority over approval status.
- Record consent subject, version, scope, timestamp, actor, and revocation state.
- Apply the same privacy default to guest, registered, and premium users.
- Require durable ownership for public content management or disallow guest publishing.
- Audit historical auto-approved records. Any deletion/archive remediation is a destructive data action and requires
  explicit owner approval before execution.

### Education OTP secrecy

- Store only a short-lived keyed hash/HMAC in a server-only verification record.
- Never include code, hash, attempt count, or server verification metadata in profile DTOs.
- Bind request to normalized email, user, purpose, expiry, and rate-limit state.
- Compare in constant time where practical, limit attempts, atomically consume once, and invalidate older codes.
- Rate-limit user, email, IP/risk signal, and resend; avoid account enumeration.

### Verified reward identity

- Require a server-confirmed verified primary identity for registration/referral rewards.
- Require unique source events and one-time constraints in durable storage.
- Link referral reward to qualified activation, not account creation.
- Add velocity, device/session risk, self-referral, cyclic-referral, and payment reversal controls.
- Fail closed if reward eligibility state cannot be loaded.

### Guest conversion and checkout

- Distinguish visitor, guest, registered-unverified, registered-verified, and premium in UI and APIs.
- Preserve the same identity or run an atomic, idempotent transfer of projects, wallet, history, and ownership.
- Do not open Checkout for an email-less or non-durable account.
- Show conversion failure inline; never close the modal on an unconfirmed operation.

### Money integrity

- Replace absolute balance mutation with an atomic ledger and reservation lifecycle.
- Store Stripe event processing state after, not before, successful side effects.
- Validate environment, payment status, expected product/price/amount/currency, account, user, and source IDs.
- Handle retries, ordering, renewal, refund, dispute, cancellation, and failed payment.
- Reconcile daily and alert on any unexplained drift.

## Friends-team collaboration controls

- V1 capacity is one owner plus up to five invited verified members, subject to D-023 confirmation.
- Invite tokens are hashed, recipient-bound, expiring, single-use, revocable, rate-limited, and replay-tested.
- Joining exposes no personal project or wallet; each project requires an explicit owner share action.
- Every read/write/analysis/export rechecks team, membership, role, project permission, and current removal state server-side.
- Removal and project unshare revoke future access immediately while preserving source ownership and audit evidence.
- Team Rapido uses a separate ledger account; personal value is never transferred or used as silent fallback.
- Reserve/settle/void records fund source, team, member, project, operation, limits, and permission snapshot.
- Two-team, removed-member, concurrent-spend, invite-race, export/delete, refund, and team-closure tests are mandatory.
- Friends Team is not a school contract; learner/cohort processing requires the separate education pilot boundary.

## Storage and file controls

Separate public gallery assets from private project/history/mentor assets. Required controls:

- file-level or server-proxy authorization for private content;
- owner-scoped read and server-only create/update/delete where policy requires;
- signed, short-lived access rather than permanent public URLs;
- MIME allowlist plus magic-byte/parser validation, size/page/dimension/count limits, and decompression guards;
- generated server filenames, content checksum, and quarantine state;
- antivirus/content inspection where supported;
- no active content served inline under the trusted application origin;
- explicit retention, deletion queue, tombstone, and backup-expiry semantics;
- storage permission integration tests with two users and an anonymous actor.

The audited shared bucket configuration uses broad authenticated update/delete permissions and disables file security.
Treat tenant isolation as a release blocker for institution work.

## Public and community surfaces

Gallery, peer review, and Confessions require a complete safety lifecycle:

- server-owned publish/moderation status;
- durable owner or documented anonymous-control token;
- rate limits and abuse scoring;
- report, block, archive/delete, appeal, and moderator queue;
- safe rendering and link handling;
- duplicate/spam and reward-fraud controls;
- moderation failure policy that does not publish by default;
- crisis/escalation policy for threats, self-harm, harassment, and illegal content;
- retention and evidence policy for reports.

Do not scale engagement or rewards before these controls and staffing expectations are accepted.

## AI trust boundary

Treat uploaded artifacts, PDF text, project context, chat history, and previous model output as untrusted data. They must
not become system instructions by string concatenation. Model output is also untrusted until schema, range, semantic,
and policy validation passes.

Required controls:

- separated instruction and data channels where provider API supports them;
- operation-specific schema, length/count/range limits, and output budget;
- prompt-injection and adversarial artifact evals;
- advisory labels and prohibition on grading/certification claims;
- confidence/uncertainty and “insufficient evidence” behavior;
- human moderation before public/high-risk output;
- no automatic progression, reward, or publication from unvalidated output;
- redacted telemetry and restricted prompt/output access;
- provider/model/version audit record without exposing secret material.

## Application and platform controls

### Browser and origin

- strict production origin allowlist for checkout, portal, mutations, and callbacks;
- CSP introduced in report-only mode, then enforced after violation review;
- HSTS on production, `nosniff`, referrer policy, permissions policy, and clickjacking defense;
- secure, HTTP-only, same-site cookie settings as applicable;
- production canonical and explicit `noindex` for non-production environments.

### Dependencies and CI

- supported/pinned Node and compatible exact React pair;
- production vulnerability policy that blocks known exploitable high/critical findings;
- time-bounded, owner-approved exceptions with reachability evidence;
- lockfile review and dependency provenance/SBOM;
- GitHub Actions pinned to reviewed commit SHAs;
- CodeQL and secret scanning that run even when application path filters change;
- full repository/history/CI secret scanning, not staged-diff only;
- immediate rotation and incident review if a live credential is discovered.

### Rate limiting and abuse

Use a shared durable limiter in production, with explicit fail-closed behavior for costly or financial mutations. Apply
separate policies to auth/OTP, AI operation, file upload, gallery/confession write, peer reward, promo validation,
checkout, portal, and support logging. Return generic errors and preserve internal reason codes in redacted telemetry.

## Privacy lifecycle

Define a data inventory before institution pilots:

| Data | Purpose | Access | Retention | User control | Provider transfer |
|---|---|---|---|---|---|
| Identity/profile | Account and eligibility | User/support minimum | Contract/legal need | Correct/export/delete | Appwrite/identity provider |
| Private artifact | Requested critique | Owner and necessary processors | Product contract | Download/delete | Storage and AI provider |
| Critique/chat | Deliver and resume service | Owner and limited support | Product contract | Export/delete | AI provider as needed |
| Public submission | User-directed publishing | Public | Until revoke/policy | Revoke/delete | CDN/search if indexable |
| Billing record | Payment, tax, disputes | Finance/support minimum | Legal requirement | Access where required | Stripe |
| Analytics | Product improvement | Restricted aggregate | Shortest useful | Consent/opt-out | Approved analytics vendor |
| AI eval sample | Quality improvement | Restricted review | Explicit program | Separate consent/delete | Approved tooling |

“Delete” must stop future AI retrieval immediately. If backups or legal records persist, state the scope and expiry
plainly. The audited memory path can continue loading soft-deleted content; close this before making deletion claims.

Analytics events must never contain email, filenames, raw prompt, critique text, artifact URLs, or image/PDF content.
Cookie-banner close and accept actions must be distinct and accurately named.

## Education pilot and institution gates

Before any learner data enters a concierge school pilot, demonstrate a bounded manual single-cohort security boundary:

- a dedicated environment/data namespace, storage boundary, key set, and cohort ledger for each pilot with no shared
  organization tenancy;
- roster allowlist and least-privilege learner/educator/support access, with manual access review;
- audit evidence for access, export, deletion, restore, and policy changes;
- age/minor policy and consent responsibility;
- data processing terms and provider list;
- retention/export/delete process;
- incident notification and support commitments;
- AI limitations and non-grading policy;
- D-028 assignment-scoped educator access, learner notice/ownership/portability, and immutable access logs;
- contract-backed server-only allowance grants, atomic cohort spending, overage disabled, and daily reconciliation;
- verified isolated-cohort backup/restore, two-user, and two-pilot cross-boundary tests.

This permits paid pilots only through `feat/education-pilot-cohort-controls`, without pretending a reusable institution
platform exists. The second pilot uses a separate approved environment/namespace; it cannot share unproven institution
tenancy. After D-027 approves investment, prove organization tenancy/RBAC first, then cohort, billing, reporting, and
recovery in separate branches before broader institution availability.

## Security verification matrix

| Control | Required proof |
|---|---|
| Identity | Cross-account, anonymous, unverified, replay, conversion, and recovery integration tests |
| Wallet | Concurrency, duplicate, failure, refund, and reconciliation tests |
| Stripe | Signed fixtures plus replay/out-of-order/partial-failure integration tests |
| Storage | Two-user and anonymous permission tests for every bucket/class |
| Publishing | No-write-before-consent and revoke/delete tests |
| Files | Real parser/magic-byte/size/bomb corpus against production handlers |
| AI | Injection, malformed output, oversized output, safety, quality, and fallback eval suite |
| Browser | Header scanner, CSP report review, origin/CSRF negative tests |
| Dependencies | Clean install, SBOM, audit policy, exception register, deploy/runtime scan |
| Privacy | Export/delete/retention/provider trace and deleted-memory exclusion test |

Existing tests that reimplement helper logic do not satisfy these proofs. Tests must import or call production paths.

## Incident priorities

Immediate incident playbooks are required for unauthorized publication, cross-tenant file access, credit/payment drift,
credential exposure, provider data leakage, abusive public content, and destructive migration. Each playbook names the
kill switch, evidence preservation, customer remediation owner, reconciliation procedure, notification decision, and
post-incident control.
