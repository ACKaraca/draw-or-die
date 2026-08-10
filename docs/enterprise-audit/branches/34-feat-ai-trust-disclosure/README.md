# feat/ai-trust-disclosure

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 4 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-011 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | M / Medium |
| Base | Protected `dev-main` |
| Depends on | `fix/privacy-data-lifecycle`, `fix/ai-memory-cache-semantics`, `fix/ai-moderation-boundaries` |
| Accountable roles | Product + privacy/legal + AI + design/accessibility |

## Outcome

Explain AI processing, uncertainty, memory, public use, and professional limits at the moment each user decides.

## Evidence

Privacy copy contradicts provider data flow; memory includes hidden/deleted behavior; outputs can resemble authority; structural/accessibility/egress advice and multi-jury correlation need accurate boundaries.

## Scope

- Label AI-generated advisory content and show confidence/insufficient-evidence behavior.
- Explain processor categories and artifact/text/chat/memory transfer before analysis.
- Provide visible memory opt-in, inspect, edit, reset, export, and delete controls.
- Require human/professional verification for structural, accessibility, egress, and regulatory decisions.
- Explain that one-completion multi-jury lenses are correlated and AUTO_CONCEPT is a draft.
- Add wrong/harmful/not-useful feedback and human review boundaries for public/institution use.

## Non-goals

No legal certification, generic disclaimer wall, hidden consent, claim that disclosure repairs unsafe backend behavior,
or dependency on a new revision feature. Revision-specific copy may extend this baseline later.

## Acceptance criteria

- [ ] User can reach processor/storage/memory explanation before submitting data.
- [ ] UI disclosure matches network/storage/provider and retention behavior.
- [ ] Memory can be disabled/reset and deleted state is honored technically.
- [ ] High-risk analysis never presents certification/approval language.
- [ ] Public sharing still requires separate explicit consent.
- [ ] Institution flow cannot auto-grade/discipline/rank from model output.
- [ ] Disclosure is localized Turkish/English, accessible, and comprehension-tested.

## Approval and migration boundary

Final legal/privacy language and provider terms require qualified review; product owner approves placement and comprehension evidence.

## Rollout

Prototype comprehension with users → staging network-flow verification → core operation rollout before capability scale
→ revision/public/institution extensions that preserve the baseline.

## Rollback

Disable the affected AI/public operation if accurate disclosure cannot be maintained; do not revert to misleading copy.

## Metrics and required artifacts

- Primary evidence: Disclosure comprehension, processor mismatch zero, memory-control completion, harmful/wrong feedback and trust contacts.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
