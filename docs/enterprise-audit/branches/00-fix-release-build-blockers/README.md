# fix/release-build-blockers

| Field | Value |
|---|---|
| Priority / phase | P0 / Phase 0 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-001 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | S–M / High |
| Base | Existing remote `dev-main` (`8869af1`) after explicit fetch/tree verification; use `main` only for an approved production hotfix |
| Depends on | None |
| Accountable roles | Release engineering + AI route owner + QA |

## Outcome

Restore one reproducible, buildable source baseline without changing the intended product contract.

## Evidence

`app/api/ai-generate/route.ts:784-802` contains unresolved merge markers. Lint, typecheck, build, CodeQL, and 15 Jest suites fail; React and React DOM resolve to incompatible exact versions.

## Scope

- Reconstruct the intended conflicting behavior from both merge parents, surrounding contracts, and characterization tests.
- Resolve all conflict markers and add a repository-wide conflict-marker gate.
- Pin compatible exact React and React DOM versions and one supported Node/npm toolchain.
- Fix the independent JSON code-fence parser regression without broad analysis refactoring.
- Expose the minimum release SHA/build identity needed to verify the recovery artifact.

## Non-goals

No prompt redesign, pricing change, route extraction, broad dependency modernization, or feature work.

## Acceptance criteria

- [ ] Fresh clone and `npm ci` complete without runtime-version mismatch.
- [ ] `rg` finds zero unresolved conflict markers in tracked source.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` pass.
- [ ] Local/preview smoke covers homepage, health, and a deterministic AI-route contract fixture.
- [ ] CodeQL reaches analysis rather than stopping at build.
- [ ] Release output identifies commit `SHA` and the conflict behavior is covered by a regression test.

## Approval and migration boundary

If merge-parent behavior is ambiguous, the product owner must select the intended contract before code is changed. Preserve both parents and the resolution in normal Git history.

## Rollout

Build an isolated preview from the branch, run the full recovery matrix twice from clean installs, preserve the currently running production deployment ID, then merge through an approved hotfix PR.

## Rollback

Revert with a new commit to the last verified buildable artifact/source pair. Never restore conflict markers or rewrite history.

## Metrics and required artifacts

- Primary evidence: All required checks green on two clean runs; source SHA equals deployed recovery SHA.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
