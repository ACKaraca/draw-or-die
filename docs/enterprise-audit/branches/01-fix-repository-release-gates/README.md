# fix/repository-release-gates

| Field | Value |
|---|---|
| Priority / phase | P0 / Phase 0 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-002 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | M / Medium |
| Base | Existing `dev-main` after the green recovery PR and history reconciliation are verified |
| Depends on | `fix/release-build-blockers` |
| Accountable roles | Release engineering + repository administrator + QA |

## Outcome

Make failed, unreviewed, or wrong-source changes unable to reach long-lived branches by accident.

## Evidence

Both long-lived branches require one approving review but no successful status checks; force-push/deletion and admin
bypass remain enabled. `dev-main` lacks `main`'s conversation-resolution and linear-history controls. Workflow path
filters miss production, test, locale, environment-contract, and documentation changes, and PR #48 merged with failing
gates.

## Scope

- Create stable always-reported required checks for lint, type, tests, build, security, and release policy.
- Remove unsafe path-filter gaps or add an always-running gate that resolves skipped jobs safely.
- Protect and reconcile the existing `dev-main` plus `main`; disable force-push/deletion and enforce administrators.
- Require conversation resolution, up-to-date branches, and reviewed high-risk changes.
- Protect validator, contract, and workflow co-changes with a ruleset or required-workflow source that the same PR cannot
  silently weaken; require non-author review when an eligible reviewer exists.
- Resolve content-addressed lifecycle/gate records to retained hosted artifacts; reject missing, mutable, expired, or
  unreachable evidence instead of trusting a pasted digest.
- Document a time-bounded, audited emergency override procedure.

## Non-goals

No application behavior or deployment-platform migration.

## Acceptance criteria

- [ ] A deliberately failing application, test-only, locale, environment, and workflow PR each produces a failing required check.
- [ ] A skipped path cannot leave a required status permanently absent or falsely green.
- [ ] Direct push, force-push, branch deletion, and merge with failed checks are rejected for both long-lived branches.
- [ ] High-risk money/identity/privacy/schema changes require a non-author approval.
- [ ] A PR that weakens the audit validator, contract, or workflow cannot satisfy its own enforcement requirement.
- [ ] Every approval, rollout, rollback, exception, and verification digest resolves to a retained immutable artifact.
- [ ] Emergency override records actor, reason, duration, and follow-up incident review.

## Approval and migration boundary

Repository setting changes require owner approval and a captured before/after API snapshot. A solo-maintainer exception cannot disable required automated checks.

## Rollout

Apply to `dev-main`, run positive and negative test PRs, then apply equivalent stricter policy to `main`.

## Rollback

Fix a broken check or use a documented time-limited bypass; do not broadly disable protections.

## Metrics and required artifacts

- Primary evidence: Unauthorized direct/failed merge count is zero; required-check coverage is 100% of PRs.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
