# ArchBuilder Asset Manifest

This document defines MVP furniture assets and metadata conventions.

## MVP categories

- `table`
- `chair`
- `flower`
- `tree`

## Storage table

`archbuilder_furniture_assets`

Core fields:
- `asset_key` (unique)
- `category`
- `source_file_type`
- `source_url`
- `bbox_json`
- `anchors_json`
- `style_tags_csv`
- `placement_constraints_json`
- `active`

## Seeded MVP assets

- `table.standard.rect.01`
- `chair.standard.01`
- `flower.pot.small.01`
- `tree.indoor.medium.01`

## Placement metadata

`bbox_json` example:
- width
- depth
- height

`anchors_json` example:
- center
- edge-aligned anchor points

`placement_constraints_json` example:
- minimum spacing
- near-window preference
- pairing hints (chair with table)

## Extension strategy

Phase after MVP:
- Admin upload workflow
- Geometry quality checks
- Semantic tagging for retrieval
- Style packs and category expansions
