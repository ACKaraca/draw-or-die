# P0 Operator Containment Runbook

| Control | Value |
|---|---|
| Status | **DRAFT — DO NOT EXECUTE** |
| DRI | UNASSIGNED |
| Approver | UNASSIGNED — incident owner plus affected security/commerce/data owner |
| Environment / target | UNSET |
| Required permissions | Read-only preflight, then least-privilege scoped configuration/traffic control |
| Decision record | Incident/change record with exact holds, customer impact, and re-enable gates |
| Code dependency | None for proven existing operator controls; missing controls transfer to the hotfix branch |
| Last tested | NEVER |
| Next review | Before any live containment action and daily while a hold remains active |

## Purpose

Contain active P0 exposure before permanent remediations or the full migration platform are ready. This runbook owns
operator/configuration actions only. `fix/p0-capability-containment` separately owns code guards and has one build,
deployment, and rollback boundary.

## Read-only preflight

1. Resolve the exact environment, project/account, current release SHA/digest, control source, and operator identity.
2. Verify current gallery delivery/write, OTP, reward, Checkout, Stripe intake/processing, wallet, storage, and AI-model
   state without printing secrets or user content.
3. Confirm how signed Stripe events remain durable if business effects pause; do not pause effects until every new
   Checkout is held.
4. Confirm portal, cancellation, refund, export/delete, and support paths that must remain available.
5. Record the last known safe configuration and a read-only verification query for every proposed hold.
6. Stop if the target, permission, event durability, customer impact, or rollback state is ambiguous.

## Hold matrix

| Capability | Restrictive hold | Preserve | Permanent re-enable owner |
|---|---|---|---|
| Gallery | Stop new public writes and non-consent-proven historical delivery; hold all delivery if records cannot be distinguished safely | Records, consent evidence, export/revoke, incident evidence | Consent and historical-remediation branches |
| Education verification | Stop code issue/verify; prevent verification metadata from reaching clients; reject legacy plaintext format | Account access and re-verification path | OTP-secrecy branch |
| Rewards | Stop every new registration/referral/education/promo grant | Existing customer balance and source evidence | Verified-reward and ledger branches |
| Stripe/Checkout | Stop all new subscription/Rapido Checkout before pausing effects; retain signed inbound events | Portal, cancel, refund, support, event history | Webhook and entitlement branches |
| Rapido/paid AI | Stop paid operations when atomic reservation/settlement is unavailable | Purchased value, history, free recovery/support | Atomic-ledger branch |
| Storage | Stop broad direct client mutation; deny access that cannot pass existing owner validation | Source objects and owner mapping | Tenant-storage branch |
| AI model | Stop paid AI when the configured model is unsupported, retired, or unverified | User artifacts and retry/recovery state | Model-lifecycle branch |

## Approval checkpoint

Keep this runbook `DRAFT — DO NOT EXECUTE` until the DRI, approver, environment, release, exact controls, dry-run,
customer-impact copy, evidence queries, and rollback/re-enable gates are filled. Any additive state or restrictive
permission change follows the [emergency change protocol](./EMERGENCY-CHANGE-PROTOCOL.md). No deletion, balance
adjustment, entitlement clawback, event removal, broad permission, or force-push is authorized here.

## Execution pattern

1. Apply one approved restrictive hold to one resolved target.
2. Verify the expected risky side effect is zero and protected customer paths still work.
3. Record actor, time, environment, release/config version, result, metric, next review, and permanent owner.
4. Stop on payment without entitlement, lost Stripe event, unrelated access loss, data mutation, or release mismatch.
5. Repeat only after the previous hold is reconciled; review every active hold daily.

## Rollback and re-enable

Rollback means restoring the last verified restrictive configuration after a failed containment attempt, not reopening
the risky capability. Re-enable only after the permanent branch acceptance, exact-release verification, reconciliation,
and incident-owner approval pass. Never re-enable automatic publishing, plaintext verification, unverified rewards,
unreconciled Checkout, broad storage mutation, non-atomic paid AI, or a retired model as a rollback.

## Closure evidence

- zero public write/delivery without explicit consent;
- zero client-visible OTP material and zero legacy-code verification;
- zero unverified grants and zero new Checkout while Stripe effects are paused;
- zero successful payment without reconciled entitlement and zero lost signed events;
- zero broad direct storage mutation and zero paid operation on an unsafe wallet/model path;
- named hold owner, start, review, release/config version, customer impact, and re-enable decision for every control.
