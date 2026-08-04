# Release baseline recovery verification

## Immutable delivery record

| Evidence | Value |
|---|---|
| Pull request | [#49](https://github.com/ACKaraca/draw-or-die/pull/49) |
| Head SHA | `1b0292f3196e7bdb6882fe74168c2fd95aac2ac9` |
| Base branch | `dev-main` |
| Merge SHA | `69f65786a5d4397524818b533f62cb83b1a6c28b` |
| Merged at | `2026-08-04T16:46:29Z` |
| Review threads | Resolved |
| Checks | Passed: [merge gates](https://github.com/ACKaraca/draw-or-die/actions/runs/30930489414) and [CodeQL](https://github.com/ACKaraca/draw-or-die/actions/runs/30930489509) |

## Local verification

The final branch head was checked with the repository-pinned Node `22.23.1` and npm `10.9.8`:

- isolated `npm ci`: passed, with React and React DOM both resolving to `19.2.7`;
- `npm run check:conflicts`: passed;
- `npm run lint`: passed with zero errors and 128 pre-existing warnings;
- `npm run typecheck`: passed;
- `npm run test`: 39 suites and 217 tests passed;
- `npm run build`: passed;
- `npm run test:e2e:smoke`: two Chromium smoke tests passed;
- `npm run check:secrets`: passed;
- `npm run check:stripe-config`: passed with non-production test configuration;
- workflow YAML parsing and `git diff --check`: passed.

## Hosted verification

The final PR head passed:

- [merge gates](https://github.com/ACKaraca/draw-or-die/actions/runs/30930489414);
- [CodeQL analysis](https://github.com/ACKaraca/draw-or-die/actions/runs/30930489509);
- security and hardcoded-secret checks;
- SonarCloud, Snyk, and DeepScan (`0` new issues and `1` fixed issue);
- the Appwrite preview build.

No actionable review thread remained. A separate human GitHub approval was not recorded; the repository owner had
authorized branch creation, pull requests, and merge for this delivery.

## Boundaries and remaining evidence

- The repaired baseline is on `dev-main`; `main` and production were intentionally not changed.
- R-001 therefore remains open until an approved production release reports the exact expected SHA.
- The recovered batch behavior has focused unit coverage. Full authenticated `/api/ai-generate` production-path
  fixtures remain owned by `chore/critical-contract-harness`.
- The production dependency audit still reports 15 findings (9 high and 6 moderate); remediation belongs to
  `chore/security-runtime-dependencies` and was not mixed into this recovery.

## Rollback proof

The change is a normal merge commit with preserved parent history. If verification regresses, create a rollback PR
that reverts `69f65786a5d4397524818b533f62cb83b1a6c28b`, then rerun the same local and hosted matrix. Do not force-push,
rewrite history, or restore conflict markers.
