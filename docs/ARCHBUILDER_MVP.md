# ArchBuilder MVP

ArchBuilder is a progressive architectural planning flow that transforms project intent into structured planning outputs, then into drawing-ready geometry and export artifacts.

## User flow

1. Create project intent (title, type, location, target area, constraints).
2. Start planning session.
3. Run one planning step at a time.
4. Approve each step output before advancing.
5. Generate drawing from approved planning outputs.
6. Place furniture assets.
7. Download or consume export payloads.

## Planning steps

- `site`
- `constraints`
- `envelope`
- `program`
- `stacking`
- `adjacency`

Each step is persisted in `archbuilder_step_outputs` and supports approval checkpointing.

## Deterministic validators

Current deterministic checks:
- Program area sum consistency
- Duplicate space detection
- Floor allocation consistency

Validation runs during planning and is included in adjacency output metadata.

## API surface

- `POST /api/archbuilder/projects`
- `POST /api/archbuilder/sessions`
- `POST /api/archbuilder/sessions/[id]/orchestrate`
- `POST /api/archbuilder/sessions/[id]/approve-step`
- `POST /api/archbuilder/sessions/[id]/generate-drawing`
- `POST /api/archbuilder/sessions/[id]/place-furniture`
- `GET /api/archbuilder/sessions/[id]/exports`

## Feature gating

- `archbuilder_enabled`: controls broad availability.
- `archbuilder_ifc_export`: controls IFC export readiness.
- `FEATURE_ARCHBUILDER_IFC_EXPORT`: runtime fallback gate.

## Current MVP boundary

Included:
- Schema-driven planning contracts
- Deterministic step outputs and approval flow
- DXF-first export and preview payloads
- Basic furniture placement and collision scoring

Deferred:
- Production-grade IFC serializer pipeline
- Advanced furniture layout heuristics
- External sample normalization automation
