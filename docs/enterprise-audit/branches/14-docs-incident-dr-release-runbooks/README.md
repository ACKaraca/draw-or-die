# docs/incident-dr-release-runbooks

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 2 |
| Status | Planned |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-017 and D-018 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | M / Low |
| Base | Protected `dev-main` |
| Depends on | `fix/staging-artifact-promotion`, `feat/operational-observability` |
| Accountable roles | SRE + security + product/communications + commerce |

## Outcome

Give the operator an executable response for release, privacy, payment, AI, storage, and data-loss incidents.

## Evidence

No general release/rollback, incident severity, on-call/escalation, postmortem, backup/restore, Stripe replay, or customer-compensation runbook is present.

## Scope

- Define SEV1–SEV4, incident command, evidence, communication, escalation, and postmortem process.
- Write runbooks for bad release, unauthorized publication, cross-tenant files, money drift, Stripe queue, AI outage/cost spike, credential leak, and failed migration.
- Define RPO/RTO by data class and backup/restore verification.
- Document immutable artifact rollback, Stripe replay, ledger adjustment, and customer compensation.
- Record drill cadence, owner, last result, follow-up items, and expiry.

## Non-goals

No claim that documentation alone proves recovery; no production data deletion.

## Acceptance criteria

- [ ] Each runbook names detection signal, kill switch, owner, prerequisites, commands/checks, rollback, and customer decision.
- [ ] At least one release rollback and one isolated backup restore drill are completed and recorded.
- [ ] A Stripe replay drill preserves event history and reconciles value.
- [ ] Unauthorized-publication drill preserves evidence and prevents further exposure.
- [ ] Contacts and secrets are referenced securely, not embedded.
- [ ] Postmortem actions link to owned risks/branches.

## Approval and migration boundary

RPO/RTO, customer communication, compensation, and legal notification decisions require owner and relevant specialist approval.

## Rollout

Tabletop first, then staging technical drills, then a bounded production rollback exercise during a controlled release window.

## Rollback

Version and correct runbooks through normal commits; never erase drill or incident history.

## Metrics and required artifacts

- Primary evidence: Drill completion, measured recovery/detection time, overdue action items, restore integrity.
- Required artifacts: approved runbook templates, named control owners, tabletop records, staged drill evidence, measured
  recovery results, unresolved follow-ups, and review/expiry dates.
- Closure requires the linked risk-register items to meet the global closure policy.
