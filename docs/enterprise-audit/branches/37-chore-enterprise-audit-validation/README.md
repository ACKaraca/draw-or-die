# chore/enterprise-audit-validation

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 0 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED — required roles: release engineering + documentation owner + QA |
| Target | UNSET — open immediately after the audit package is merged |
| Decision gates | D-002 |
| Blocked until | Enterprise audit package is present on `dev-main` and the green recovery baseline is merged |
| Effort / delivery risk | S–M / Low |
| Base | Protected `dev-main` |
| Depends on | `fix/release-build-blockers` |
| Accountable roles | Release engineering + documentation architecture + QA |

## Outcome

Make the enterprise-audit package fail closed when its links, branch index, metadata, decisions, counts, or dependency
graph drift, including on documentation-only pull requests.

## Evidence

The branch portfolio requires automated missing-target and cycle rejection, but the repository has no validator.
Current PR and CodeQL path filters exclude `docs/**`, so a broken planning package can merge without any status check.

## Scope

- Add a dependency-free repository script that validates all enterprise-audit Markdown and branch-plan contracts.
- Check local links, final newlines, code fences, branch README/index parity, required metadata/sections, unique names,
  decision references, dependency targets, cycles, Mermaid hard-edge parity, declared counts, and traceability coverage.
- Add deterministic negative fixtures or unit tests for missing dependency, cycle, broken link, duplicate branch, and
  unknown decision failures.
- Add an npm command and include `docs/enterprise-audit/**` plus the validator/tests in PR merge-gate path coverage.
- Emit concise actionable file/branch diagnostics and a machine-readable summary artifact.
- Document how branch PR/merge SHA and status are updated in `TRACEABILITY.md` without weakening the immutable plan history.

## Non-goals

No generic Markdown formatter, external SaaS, automatic branch creation/merge, DRI assignment, roadmap reprioritization,
application runtime change, or silent repair of invalid documentation.

## Acceptance criteria

- [ ] The current package passes with declared Markdown/branch/dependency/decision counts.
- [ ] Each negative fixture fails for the intended reason and exits non-zero.
- [ ] Every documentation-only PR targeting `dev-main` or `main` reports the named audit-validation status.
- [ ] Missing/extra branch index rows, unknown dependencies/decisions, cycles, and Mermaid edge drift cannot merge.
- [ ] Broken local links, unbalanced fences, missing required sections/metadata, and traceability omissions cannot merge.
- [ ] Validator output contains no secrets, absolute developer paths, or network dependency.
- [ ] The standard lint/typecheck/test/build gates remain unchanged and green.

## Approval and migration boundary

Workflow permission/path changes and required-check policy need repository-owner approval. The validator is read-only and
must not rewrite docs, create branches, call GitHub, or mutate product data.

## Rollout

Local current-package pass → negative fixtures → PR path-filter proof → required status on `dev-main` → deliberately
broken test PR → equivalent `main` protection after D-002 approval.

## Rollback

Revert the validator/workflow commit only if it blocks valid changes and immediately restore a previous known-good
validator. Do not remove documentation path coverage or bypass a real contract failure.

## Metrics and required artifacts

- Primary evidence: Audit-validation coverage is 100% of relevant PRs; false-green count is zero.
- Required artifacts: validator source/tests, fixture matrix, npm command, workflow proof, machine-readable pass summary,
  branch-protection snapshot, deliberate-failure PR evidence, rollout log, and rollback proof.
