# fix/staging-artifact-promotion

| Field | Value |
|---|---|
| Priority / phase | P0 / Phase 0 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-003 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | L / High |
| Base | Protected green `dev-main` |
| Depends on | `fix/repository-release-gates` |
| Accountable roles | Release engineering + Appwrite/Vercel operator + QA |

## Outcome

Test a real isolated staging deployment and promote the same immutable artifact to production with a rehearsed rollback.

## Evidence

The staging job does not deploy staging, Playwright reads a different variable, a production site ID is used in staging validation, Node versions drift, and source archives activate before smoke tests. Project docs disagree on Vercel versus Appwrite Sites.

## Scope

- Choose and document the authoritative deployment platform and artifact format.
- Create isolated staging configuration, Appwrite resources, Stripe test mode, analytics, and `noindex`.
- Build once with provenance; deploy and test the exact digest; promote without rebuilding.
- Correct `STAGING_URL`, live-domain health, release identity, and dependency readiness checks.
- Add pre-activation smoke, progressive activation/canary, previous-deployment rollback, and a drill.

## Non-goals

No product UI redesign or database schema change beyond release metadata compatibility.

## Acceptance criteria

- [ ] Staging never references production project/site/storage/payment credentials.
- [ ] E2E proves it is calling the deployed staging URL and expected release SHA.
- [ ] Staging and production report the same promoted artifact digest.
- [ ] Production dispatch asserts `refs/heads/main` and protected environment approval.
- [ ] A forced bad canary automatically or operationally returns to the previous deployment ID within the approved target.
- [ ] Health checks fail when the target dependency or release identity is wrong.

## Approval and migration boundary

Selecting or changing the production deployment authority and environment protections requires owner approval. Never delete prior deployments during the first rollout.

## Rollout

Run staging-only for at least one full critical-journey cycle, conduct a rollback drill, then enable production promotion with a small canary.

## Rollback

Reactivate the previous immutable deployment; migrations must remain backward compatible. Never rebuild an alleged rollback artifact.

## Metrics and required artifacts

- Primary evidence: Artifact mismatch count zero; successful rollback drill; release SHA/digest visible in every environment.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
