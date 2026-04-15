# ArchBuilder Runbook

Operational guide for ArchBuilder MVP routes, data, and rollback.

## 1. Feature control

Feature flags:
- `archbuilder_enabled`
- `archbuilder_ifc_export`

Runtime env gate:
- `FEATURE_ARCHBUILDER_IFC_EXPORT`

Recommended rollout:
1. Enable internal allowlist on `archbuilder_enabled`.
2. Keep IFC export disabled.
3. Monitor planning/export success metrics.

## 2. Core tables

- `archbuilder_projects`
- `archbuilder_sessions`
- `archbuilder_step_outputs`
- `archbuilder_exports`
- `archbuilder_furniture_assets`
- `archbuilder_furniture_placements`

## 3. Health checks

API smoke sequence:
1. Create project
2. Create session
3. Orchestrate first step
4. Approve step
5. Generate drawing
6. Place furniture
7. Read exports

Expected response quality:
- clear `error` + `code` on failures
- deterministic session state transitions

## 4. Incident handling

Common symptom: `ARCHBUILDER_SESSION_NOT_FOUND`
- validate JWT and user ownership
- verify session row exists and references valid project

Common symptom: `ARCHBUILDER_PROGRAM_NOT_APPROVED`
- ensure program step has approved output
- verify approvals and current step status

Common symptom: export payload too large
- reduce room count or payload detail
- trim preview/metadata fields

## 5. Rollback strategy

Safe rollback order:
1. Disable `archbuilder_enabled` flag.
2. Keep data tables intact for audit.
3. Revert API/UI integration commit if runtime impact persists.

No destructive data deletion should be executed during first response window.

## 6. Validation commands

- `npm run lint`
- `npx tsc --noEmit`
- `npm run test`
- `npm run test:e2e:smoke` (critical changes)
