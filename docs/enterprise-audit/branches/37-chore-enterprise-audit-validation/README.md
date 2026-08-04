# chore/enterprise-audit-validation

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 0 |
| Status | Ready |
| DRI | Repository owner (accountable) + Codex (implementation) |
| Approver | Repository owner for workflow/merge authorization; independent QA evidence required before merge |
| Target | 2026-08-04 PR and `dev-main` merge window |
| Decision gates | D-002 |
| Blocked until | Hosted named check and review are green; required-check activation follows its first successful report |
| Effort / delivery risk | S–M / Low |
| Base | Protected `dev-main` |
| Depends on | `fix/release-build-blockers` |
| Accountable roles | Release engineering + documentation architecture + QA |

## Outcome

Make the enterprise-audit package fail closed when its links, branch index, metadata, decisions, counts, or dependency
graph drift, including on documentation-only pull requests.

## Evidence

The branch portfolio requires automated missing-target and cycle rejection. The audit package and green recovery
baseline are now on `dev-main`, but existing PR and CodeQL path filters exclude `docs/**`. The local implementation
validates the real package and its negative fixtures; hosted status and branch-protection evidence remain pending.

## Scope

- Add a dependency-free repository script that validates all enterprise-audit Markdown and branch-plan contracts.
- Check local links, final newlines, code fences, branch README/index parity, required metadata/sections, unique names,
  decision references, dependency targets, cycles, Mermaid hard-edge parity, declared counts, and traceability coverage.
- Pin branch-to-decision and branch-to-risk mappings, reject orphan risks and malformed table/dependency syntax, and
  cross-link lifecycle evidence rather than accepting independent PR/SHA/status fragments.
- Preserve supplemental approvals/evidence as structured timed requirements, pin resolved decision revision,
  disposition, base scope, and canonical specialist deliverables, and reject coordinated policy drift.
- Add deterministic adversarial coverage for dependency, link, lifecycle, contract, authority, evidence, repository,
  decision polarity/scope, specialist-file, and production-invocation failures.
- Add an npm command and include `docs/enterprise-audit/**` plus the validator/tests in PR merge-gate path coverage.
- Emit concise actionable file/branch diagnostics and a machine-readable summary artifact.
- Bind hosted reports to repository, commit, ref, event, run, contract digest, and validator digest.
- Document how branch PR/merge SHA and status are updated in `TRACEABILITY.md` without weakening the immutable plan history.

## Non-goals

No generic Markdown formatter, external SaaS, automatic branch creation/merge, DRI assignment, roadmap reprioritization,
application runtime change, or silent repair of invalid documentation.

## Acceptance criteria

- [x] The current package passes with declared Markdown/branch/dependency/decision counts.
- [x] Each negative fixture fails for the intended reason and exits non-zero.
- [x] The 134-case adversarial suite covers production invocation, coordinated policy/table drift, supplemental gates,
  strict lifecycle evidence, future/revoked evidence, authority drift, decision scope, and specialist-file mutation.
- [ ] Every documentation-only PR targeting `dev-main` or `main` reports the named audit-validation status.
- [ ] Missing/extra branch index rows, unknown dependencies/decisions, cycles, and Mermaid edge drift cannot merge.
- [x] Broken local links, unbalanced fences, missing required sections/metadata, and traceability omissions fail locally.
- [x] Validator output contains no secrets, absolute developer paths, or network dependency; documentation states that
  offline consistency is not external GitHub/approval authentication.
- [x] The standard lint/typecheck/test/build gates remain unchanged and green locally.

## Approval and migration boundary

Workflow permission/path changes and required-check policy need repository-owner approval. The validator is read-only and
must not rewrite docs, create branches, call GitHub, or mutate product data.

## Rollout

Local current-package pass and negative fixtures are complete. Next: PR path/status proof → required status on
`dev-main` → deliberately broken test evidence → equivalent `main` protection only after the remaining D-002/main
approval.

## Rollback

Revert the validator/workflow commit only if it blocks valid changes and immediately restore a previous known-good
validator. Do not remove documentation path coverage or bypass a real contract failure.

## Metrics and required artifacts

- Primary evidence: Audit-validation coverage is 100% of relevant PRs; false-green count is zero.
- Required artifacts: validator source/tests, fixture matrix, npm command, workflow proof, machine-readable pass summary,
  branch-protection snapshot, deliberate-failure PR evidence, rollout log, and rollback proof.
