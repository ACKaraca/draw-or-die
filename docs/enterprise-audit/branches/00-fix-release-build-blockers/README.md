# fix/release-build-blockers

| Field | Value |
|---|---|
| Priority / phase | P0 / Phase 0 |
| Status | Merged to `dev-main` on 2026-08-04; production/`main` promotion not performed |
| DRI | Repository owner (scope/merge authorization) + Codex (implementation) |
| Approver | Owner delivery authorization + automated repository gates; no separate human GitHub review recorded |
| Target | Completed on `dev-main`; production promotion requires explicit major-release approval |
| Decision gates | D-001 |
| Blocked until | Production closure requires an approved `main` release and exact production-SHA verification |
| Effort / delivery risk | S–M / High |
| Base | Existing remote `dev-main` (`8869af1`) after explicit fetch/tree verification; use `main` only for an approved production hotfix |
| Depends on | None |
| Accountable roles | Release engineering + AI route owner + QA |

## Outcome

Restore one reproducible, buildable source baseline without changing the intended product contract.

## Evidence

The audited snapshot contained unresolved merge markers in `app/api/ai-generate/route.ts:784-802`. Lint, typecheck,
build, CodeQL, and 15 Jest suites failed; React and React DOM resolved to incompatible exact versions. PR
[`#49`](https://github.com/ACKaraca/draw-or-die/pull/49) repaired the baseline and merged to `dev-main` as
`69f65786a5d4397524818b533f62cb83b1a6c28b`. See [verification evidence](./VERIFICATION.md).

## Scope

- Reconstruct the intended conflicting behavior from both merge parents, surrounding contracts, and characterization tests.
- Resolve all conflict markers and add a repository-wide conflict-marker gate.
- Pin compatible exact React and React DOM versions and one supported Node/npm toolchain.
- Fix the independent JSON code-fence parser regression without broad analysis refactoring.
- Expose the minimum release SHA/build identity needed to verify the recovery artifact.

## Non-goals

No prompt redesign, pricing change, route extraction, broad dependency modernization, or feature work.

## Acceptance criteria

- [x] Fresh isolated install and `npm ci` complete on the pinned Node/npm runtime without a version mismatch.
- [x] The repository conflict-marker gate finds zero unresolved markers in tracked source.
- [x] `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` pass.
- [x] Local smoke covers homepage and health; a deterministic batch-helper fixture protects the recovered AI-route behavior.
- [x] CodeQL reaches and completes analysis.
- [x] Release output identifies the exact commit SHA; recovered batching/error isolation has regression coverage.

## Approval and migration boundary

D-001 selected reconstruction from both parents: bounded parallel batches, isolated worker failures, and structured
error reporting. The original histories and the merge resolution remain in normal Git history.

## Rollout

The branch passed the local recovery matrix and all hosted checks, produced a successful Appwrite preview, and merged
to `dev-main`. It was not promoted to `main`; production closure remains a separately approved release operation.

## Rollback

Revert merge commit `69f65786a5d4397524818b533f62cb83b1a6c28b` through a new PR if the recovery regresses.
Never restore conflict markers or rewrite history.

## Metrics and required artifacts

- Primary evidence: PR #49 checks were green and the merge SHA is immutable in `dev-main`.
- Delivered artifacts: before/after evidence, regression tests, exact runtime/dependency pins, release identity checks,
  successful preview build, and rollback instructions.
- A direct authenticated AI-route contract fixture remains part of `chore/critical-contract-harness` rather than this
  narrow conflict recovery.
- R-001 remains open for production until an approved `main` release matches the verified source SHA.
