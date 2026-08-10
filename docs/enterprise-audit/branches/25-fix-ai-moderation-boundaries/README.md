# fix/ai-moderation-boundaries

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 4 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-005 and D-021 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | L / High |
| Base | Protected `dev-main` |
| Depends on | `fix/explicit-gallery-consent`, `feat/server-enforced-kill-switches`, `refactor/ai-operation-registry` |
| Accountable roles | Trust & safety + AI + gallery/community + QA |

## Outcome

Make all public AI-assisted publishing pass a server-owned, fail-pending moderation state machine.

## Evidence

Confessions approves on missing key/non-2xx/parse/network errors and stores before a safe decision; Hall/Wall paths bypass the safer community moderation and client approval can reach public feed.

## Scope

- Separate generation and moderation policy/model/capability.
- Use one private → consented → pending_review → approved/rejected → revoked state across public paths.
- Map outage, parse uncertainty, injection suspicion, or no policy result to pending review.
- Run deterministic MIME/PII/spam/ownership checks before generative moderation.
- Quarantine/clean orphan or rejected uploads and add report/review/appeal audit.
- Keep Confessions disabled until its product purpose and human escalation capacity are accepted.

## Non-goals

No engagement/reward expansion or promise that generative moderation replaces human review.

## Acceptance criteria

- [ ] With provider/key/network/parse failure, approved public records are zero.
- [ ] Hall/Wall/Community use the same server-owned policy and ignore client approval fields.
- [ ] Prompt-injection corpus cannot cross the approval boundary.
- [ ] Public feed query returns zero unmoderated/revoked items.
- [ ] Rejected/orphan upload cleanup is idempotent and observable.
- [ ] Moderator actions and appeals are authorized/audited.
- [ ] Kill switch removes new public exposure without losing evidence.

## Approval and migration boundary

Moderation policy, retention, crisis escalation, and enabling Confessions require product/security/trust-safety approval.

## Rollout

Keep writes held → shadow moderation on consented synthetic/approved fixtures → human review → bounded public cohort → full policy.

## Rollback

Return all new submissions to private/pending and disable feed writes; never fail open.

## Metrics and required artifacts

- Primary evidence: Unmoderated approval zero; review age, appeal/reversal, orphan cleanup, abuse-report rate.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
