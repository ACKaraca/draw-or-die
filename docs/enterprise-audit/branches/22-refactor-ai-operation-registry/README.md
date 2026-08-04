# refactor/ai-operation-registry

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 4 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-010 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `fix/ai-model-lifecycle`, `fix/ai-request-lifecycle`, `refactor/versioned-appwrite-migrations`, `chore/critical-contract-harness` |
| Accountable roles | AI + commerce + data + product + QA |

## Outcome

Give every AI workflow one explicit input, entitlement, price, model, prompt, output, persistence, and telemetry contract.

## Evidence

The core AI route is about 3,922 lines and mixes policies; only four operations send strict schemas, scores/state are weakly validated, and gallery/Confessions/portfolio repeat provider logic.

## Scope

- Create a typed operation contract and migrate one operation before broader extraction.
- Validate input and strict provider/runtime output with semantic score/bbox/list/string bounds.
- Separate system policy from untrusted artifact, PDF text, memory, chat, and prior output.
- Centralize server entitlement/cost, model/deadline/budget, prompt/schema version, cache policy, persistence, and telemetry.
- Return typed responses instead of JSON inside strings.
- Make model output advisory; deterministic server policy owns financial, progression, and publication effects.

## Non-goals

No simultaneous migration of every operation, pricing change, UI rewrite, or model upgrade.

## Acceptance criteria

- [ ] The first migrated operation has characterization parity and no unapproved price/behavior change.
- [ ] Unknown/malformed fields and out-of-range scores/boxes are rejected.
- [ ] Every accepted output is provider-schema and runtime-semantic valid.
- [ ] User data cannot override system policy/state/schema in adversarial tests.
- [ ] Model fields do not directly mutate wallet, entitlement, progression, or public status.
- [ ] Operation prompt/schema/model versions and provenance are persisted.
- [ ] Legacy and registry paths can be compared and safely switched.

## Approval and migration boundary

Changing operation price, output contract, progression, public effect, or persisted schema requires explicit product/commerce/data approval.

## Rollout

Introduce registry seam → migrate one low-risk operation in shadow/canary → compare → repeat in small branches/PRs.

## Rollback

Switch that operation to the characterized legacy adapter while preserving new versioned result data; do not remove the registry seam globally.

## Metrics and required artifacts

- Primary evidence: Registry coverage by operation; schema failure, behavior parity, untrusted-policy override zero.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
