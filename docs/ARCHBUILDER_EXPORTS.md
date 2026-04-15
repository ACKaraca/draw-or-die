# ArchBuilder Exports

ArchBuilder export pipeline is currently DXF-first with explicit IFC gating.

## Supported formats

- `DXF` (MVP primary)
- `PNG` (preview payload)
- `IFC` (feature-gated)

## Export table

`archbuilder_exports`

Key fields:
- `project_id`
- `session_id`
- `user_id`
- `export_format`
- `status`
- `artifact_url`
- `preview_url`
- `payload_json`
- `error_code`
- `include_furniture`

## DXF strategy

Current DXF payload:
- 2D room polygons via `LWPOLYLINE`
- furniture points via `POINT` entities
- layer naming by floor and furniture category

## Preview strategy

Current preview payload:
- SVG generated from room geometry and furniture markers
- persisted as payload JSON metadata

## IFC strategy

IFC route is blocked by two gates:
1. Feature flag `archbuilder_ifc_export`.
2. Runtime gate `FEATURE_ARCHBUILDER_IFC_EXPORT=true`.

Default state: disabled.

## Error handling

Example error codes:
- `ARCHBUILDER_IFC_DISABLED`
- `ARCHBUILDER_PROGRAM_NOT_APPROVED`
- `ARCHBUILDER_DRAWING_PARSE_FAILED`

All export endpoints return explicit code + localized error text.
