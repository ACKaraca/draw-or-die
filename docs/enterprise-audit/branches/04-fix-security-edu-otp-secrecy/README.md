# fix/security-edu-otp-secrecy

| Field | Value |
|---|---|
| Priority / phase | P0 / Phase 1 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | None — branch approval and emergency-change approval only |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | M / High |
| Base | Protected `dev-main` |
| Depends on | `fix/release-build-blockers`, `fix/repository-release-gates`, `fix/p0-capability-containment` |
| Accountable roles | Security + identity engineering + QA |

## Outcome

Require actual mailbox possession for education verification and keep verification secrets server-only.

## Evidence

The OTP is stored on the profile, the normalized profile shape includes it, and the profile API broadly spreads the profile back to the authenticated user.

## Scope

- Replace broad profile serialization with an explicit public DTO allowlist.
- Store a short-lived HMAC/keyed hash in a server-only verification record.
- Bind code to user, normalized email, purpose, expiry, attempts, and delivery state.
- Atomically consume once; invalidate previous codes and rate-limit user/email/IP risk dimensions.
- Reject or securely migrate legacy plaintext verification state.

## Non-goals

No new education pricing or institution identity provider.

## Acceptance criteria

- [ ] Profile and log responses never expose code, hash, attempts, Stripe IDs, or internal verification metadata.
- [ ] Requesting a code without mailbox access cannot complete verification.
- [ ] Expired, replayed, superseded, over-attempted, wrong-user, and wrong-email codes fail.
- [ ] Concurrent verification accepts at most one consume.
- [ ] Delivery failure cannot expose or mark the code usable through the client.
- [ ] Enumeration and rate-limit tests exercise production handlers.

## Approval and migration boundary

Schema/legacy-data handling requires owner approval. If safe migration is uncertain, invalidate old codes and ask users to reverify rather than retaining plaintext.
Emergency execution must follow the [emergency change protocol](../../EMERGENCY-CHANGE-PROTOCOL.md).

## Rollout

Inventory and invalidate legacy plaintext state offline. The production verifier must never accept or compare legacy
plaintext codes. Issue only the new HMAC-backed format and require affected users to reverify.

## Rollback

Disable education verification temporarily; never restore plaintext OTP or broad profile DTO behavior.

## Metrics and required artifacts

- Primary evidence: Client-visible OTP material zero; replay success zero; verification delivery/expiry/failure observable.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
