# feat/shared-team-rapido-pool

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 6 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED — required roles: commerce/finance + security + product |
| Target | UNSET — assign after team authorization and ledger gates |
| Decision gates | D-024 and D-029 |
| Blocked until | Team permission contract, atomic ledger, observability, and kill switches are green |
| Effort / delivery risk | XL / High |
| Base | Protected `dev-main` |
| Depends on | `feat/private-team-workspace`, `fix/atomic-rapido-ledger`, `feat/server-enforced-kill-switches`, `feat/operational-observability` |
| Accountable roles | Commerce/ledger + team identity + security + product + QA |

## Outcome

Give an authorized team a separate shared Rapido pool that members can consume for team analyses without moving,
merging, or silently taking their personal Rapido.

## Evidence

The individual wallet does not model a team funding source, member authority, per-member limits, team operation
provenance, removal during an in-flight request, or team refund/expiry/reconciliation.

## Scope

- Create a team ledger account/projection distinct from every member's personal purchased, allowance, earned, and promo value.
- Use controlled test/admin fixtures for the two approved v1 sources only: periodic Team allowance and owner-purchased
  Team top-up. Stripe Team sale/funding belongs to `feat/team-packaging`.
- Never transfer a personal balance into or out of the pool by implication.
- Authorize reserve/settle/void at operation time using current membership, role, team/project, budget, and kill-switch state.
- Record immutable team, funder/source, member, project, operation, reservation, settlement, and entitlement provenance.
- Support owner-configured member spend limits and a restrictive pause without deleting value or history.
- Define concurrent member spend, invite/remove races, failed AI work, refunds, disputes, expiry, team closure, and reconciliation.
- Return server-confirmed personal and team projections separately; the client never chooses the charged wallet.
- Authorize only a versioned server-side Team operation allowlist approved in D-029. Team membership never grants
  personal Premium or unlocks a Team-funded operation in personal project context.
- Consume Team allowance before purchased Team value; allowance expires by period and purchased Team value is
  non-expiring by default unless D-024 explicitly changes the contract.
- Preserve owner-purchased Team value as a team liability on cancellation/closure. Stop new spend, then follow the
  D-029 reactivation/refund/credit treatment; never transfer it silently to a member, personal wallet, or cash balance.

## Non-goals

No Stripe Team sale, peer-to-peer Rapido transfer, gifting, cash-out, member-owned funding/withdrawal, referral/earned/
promo funding, school organization billing, price decision, shared Stripe credentials, or conversion of personal or
student allowance into team value.

## Acceptance criteria

- [ ] Personal and team balances, sources, expiry, refunds, and projections remain distinguishable and reconcilable.
- [ ] Team-context operations use only the selected Team pool; personal-context operations use only the personal wallet.
- [ ] One hundred concurrent member reservations cannot overspend, double-settle, lose value, or charge the wrong wallet.
- [ ] A removed/unauthorized member cannot start new spend; an in-flight operation follows the approved snapshot/cancel policy.
- [ ] Failed, refused, invalid, cancelled, timed-out, or duplicate work settles zero additional team Rapido.
- [ ] Funding retry, reserve/settle/void replay, expiry, adjustment, and team closure remain idempotent.
- [ ] Every adjustment has actor, reason, approval, source, and immutable counter-entry.
- [ ] Team-pool failure defaults to no shared charge and never falls back to personal Rapido without explicit user action.
- [ ] Operations outside the approved Team allowlist fail without Team or personal debit and cannot gain personal Premium.
- [ ] Closure, owner deletion/transfer, refund, chargeback, and remaining purchased Team value follow D-029 idempotently.

## Approval and migration boundary

D-024 must define who may fund, spend, limit, pause, refund, and close a team pool; source consumption order; member
removal behavior; and allowance expiry. D-029 owns the operation allowlist and remaining purchased-value treatment.
Schema, backfill, money movement, and any balance adjustment require explicit owner/finance approval. No historical
personal value is migrated automatically.

## Rollout

Ledger schema/fixtures → synthetic team concurrency and fault tests → shadow authorization/projection → controlled
internal team funding → reconciliation window → keep sale disabled until packaging/Stripe approval.

## Rollback

Pause new team funding/spend, preserve every journal/reservation/source record, reconcile in-flight operations, and keep
personal wallets independent. Never rewrite journal history or silently charge a member wallet.

## Metrics and required artifacts

- Primary evidence: Wrong-wallet, negative, duplicate, lost-value, unauthorized-spend, and unexplained-drift counts are zero.
- Required artifacts: threat/authority matrix, signed fixtures, concurrency/fault tests, reconciliation report, rollout and rollback proof.
