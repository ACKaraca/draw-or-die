# fix/atomic-rapido-ledger

| Field | Value |
|---|---|
| Priority / phase | P0 / Phase 3 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-008 and D-014 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `refactor/versioned-appwrite-migrations`, `feat/server-enforced-kill-switches`, `chore/critical-contract-harness`, `feat/operational-observability`, `fix/security-verified-identity-rewards` |
| Accountable roles | Commerce/data + security + SRE + QA |

## Outcome

Make every Rapido grant and spend append-only, atomic, idempotent, explainable, and reconcilable.

## Evidence

AI, portfolio, purchase, and reward paths read a balance and write an absolute new value; concurrent requests can overspend, lose grants, or create unexplained balance.

## Scope

- Create immutable journal event types for grants, purchases, reserves, settlements, voids, expiries, refunds, and adjustments.
- Keep mutable reservation leases in a separate operational store; every economic transition emits a new journal entry.
- Require immutable entry/source IDs and unique idempotency keys.
- Implement atomic reserve → settle/void and a derived balance projection.
- Backfill legacy balance as an auditable opening entry without fabricating purchase history.
- Shadow-read legacy and ledger projections, reconcile, and cut over behind a server switch.
- Move history preservation and reward grants under server-owned policy.

## Non-goals

No price/allowance change, historical user clawback, or immediate deletion of `rapido_pens`.

## Acceptance criteria

- [ ] One hundred concurrent reservations never create negative balance, duplicate spend, or lost grant.
- [ ] Duplicate/retried operation IDs settle at most once.
- [ ] Settlement, void, expiry, refund, and correction append new entries; no journal row is updated or deleted.
- [ ] Invalid, refused, timed-out, cancelled, or failed AI operations settle zero spend.
- [ ] Opening-balance backfill and shadow projection reconcile to zero unexplained difference.
- [ ] Purchased and allowance value remain distinguishable through use/refund/expiry.
- [ ] Every adjustment has an actor, reason, approval, and immutable counter-entry.
- [ ] Legacy counter remains available as a read-only rollback projection during the first rollout.

## Approval and migration boundary

Schema/backfill/cutover and any balance adjustment require explicit owner/finance approval. Never automatically claw back suspicious legacy value.

## Rollout

Create ledger → backfill opening entries → dual-write/shadow-read → investigate drift → small cohort ledger authority → staged full cutover.

## Rollback

Switch reads to the legacy projection while preserving all journal entries, operational reservation records, and
dual-write evidence. Never delete or rewrite journal history.

## Metrics and required artifacts

- Primary evidence: Negative/double spend zero; unexplained projection drift zero; reservation age and void/settle reconciliation.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
