# Decision Log

## Purpose

These decisions govern the two fixture plans.

| ID | Decision required | Recommended default | Blocks | Status |
|---|---|---|---|---|
| D-001 | Release foundation | Establish the protected foundation first | Follow-up delivery | Required |
| D-002 | Follow-up ordering | Start only after the foundation | Follow-up delivery | Required |

## Recorded decisions

### D-001 — Establish the foundation

- Date: 2026-08-04
- Owner: Release engineering
- Revision: 1
- Disposition: approved
- Allowed bases: `dev-main`
- Decision: Establish the protected delivery foundation before dependent work begins.
- Context and evidence: The fixture needs one root plan.
- Alternatives rejected: Start dependent work first.
- Consequences and risks: The follow-up remains blocked until the foundation is complete.
- Review/expiry date: Review after foundation delivery.
- Linked branch/PR: `fix/foundation`.

### D-002 — Deliver the follow-up

- Date: 2026-08-04
- Owner: Product engineering
- Revision: 1
- Disposition: approved
- Allowed bases: `dev-main`
- Decision: Deliver the follow-up only after the foundation.
- Context and evidence: The dependency graph must contain one hard edge.
- Alternatives rejected: Run both plans without an ordering contract.
- Consequences and risks: Delivery order is explicit.
- Review/expiry date: Review after follow-up delivery.
- Linked branch/PR: `feat/follow-up`.
