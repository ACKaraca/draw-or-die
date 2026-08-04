# feat/portfolio-season

| Field | Value |
|---|---|
| Priority / phase | P2 / Phase 6 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-014 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `feat/revision-learning-loop`, `fix/security-storage-tenant-isolation`, `fix/privacy-data-lifecycle`, `feat/premium-packaging`, `fix/core-flow-accessibility` |
| Accountable roles | Product/portfolio + design + AI + privacy + commerce + QA |

## Outcome

Validate a deadline-based portfolio improvement offer with reliable editing, revision, export, ownership, and explicit publishing.

## Evidence

Portfolio is a plausible outcome segment but the editor is mouse-only, auth gate is a dead end, public/share fields lack a complete UI contract, AI fallback can still charge, and mobile/autosave/export quality are not proven.

## Scope

- Define the Portfolio Season job, target cohort, bounded scope, and package contract.
- Provide whole-document issue prioritization and at least two follow-up checks through project lineage.
- Add autosave, conflict/error recovery, keyboard/touch/mobile editing, and quality-controlled export.
- Use strict layout schemas, URL/element/coordinate validation, and no charge on provider fallback failure.
- Require explicit private/public choice, owner remove/revoke, and safe share/export handling.
- Run a limited beta against portfolio completion/usefulness and contribution margin.

## Non-goals

No promise of admission/employment, public-by-default portfolio, or general-purpose design editor platform.

## Acceptance criteria

- [ ] Upload → prioritize → edit → save/reopen → recheck → export works across desktop/mobile/keyboard.
- [ ] Provider/schema failure produces no settled AI charge and preserves work.
- [ ] Autosave conflict and network recovery do not duplicate or lose pages.
- [ ] Publish is explicit, revocable, owner-scoped, and storage-isolated.
- [ ] Export output meets the approved visual/technical quality rubric.
- [ ] Outcome-pack entitlement/refund/expiry reconciles to Stripe/ledger.
- [ ] Beta experiment is preregistered with privacy, accessibility, claim, and margin guardrails.

## Approval and migration boundary

Product investment, public publishing, export retention, outcome claims, and package pricing require product/privacy/commerce approval.

## Rollout

Private internal portfolios → invite-only beta → bounded paid cohort → decide invest/hold from evidence.

## Rollback

Stop new package sales/publication, retain private read/export for existing buyers, and preserve edits/entitlements.

## Metrics and required artifacts

- Primary evidence: Portfolio completion/revision/usefulness, export success, paid margin/refund, privacy/accessibility incidents.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
