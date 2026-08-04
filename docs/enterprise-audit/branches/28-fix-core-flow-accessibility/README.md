# fix/core-flow-accessibility

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 5 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | None — branch approval only |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | L / Medium |
| Base | Protected `dev-main` |
| Depends on | `chore/critical-contract-harness`; coordinate with typed state and route slices |
| Accountable roles | Frontend + design + accessibility QA + product |

## Outcome

Make upload, auth, analysis, result, revision, and payment entry usable by keyboard, touch, screen reader, and reduced-motion users.

## Evidence

Tutorial modal lacks semantics/focus trap, nested buttons and unbound labels exist, Header navigation lacks keyboard/ARIA coverage, result comparison is hover-only, portfolio is mouse-only, and reduced-motion handling is absent.

## Scope

- Fix valid DOM, label/input/error relationships, heading/landmark order, and accessible names.
- Implement dialog focus trap/restore/Escape and non-blocking inline guidance.
- Add keyboard/touch equivalents for menus, comparisons, gates, and core actions.
- Respect reduced motion and remove prohibited scale/bounce behavior in the core slice.
- Use design-system primary/semantic colors and inline recoverable errors.
- Add axe plus human keyboard/screen-reader/touch checks and documented exceptions.

## Non-goals

No complete Portfolio accessibility rewrite or visual rebrand in this branch.

## Acceptance criteria

- [ ] Core flow meets the agreed WCAG 2.2 AA target with no critical/serious axe violations.
- [ ] All core actions complete with keyboard only and are reachable in logical focus order.
- [ ] Dialogs trap/restore focus, Escape works, and background is inert as appropriate.
- [ ] Touch users can discover/use comparison and menus without hover.
- [ ] Reduced-motion preference removes nonessential motion.
- [ ] Errors announce reason and recovery through inline state/`aria-live` without toast-only dependency.
- [ ] Automated checks plus a recorded manual accessibility script pass.

## Approval and migration boundary

Any documented WCAG exception requires product/accessibility owner, user impact, mitigation, and expiry.

## Rollout

Audit and baseline → auth/upload slice → analysis/result/revision slice → browser/assistive-tech verification → production canary.

## Rollback

Revert a narrow broken interaction while retaining semantic fixes; never remove keyboard access to restore visual behavior.

## Metrics and required artifacts

- Primary evidence: Critical accessibility defects zero; keyboard journey pass, task completion, accessibility support issues.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
