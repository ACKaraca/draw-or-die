# fix/acquisition-foundation

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 6 |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED |
| Target | UNSET — assign before branch creation |
| Decision gates | D-012 and D-020 |
| Blocked until | Listed dependencies, owner assignments, and approvals are complete |
| Effort / delivery risk | M–L / Low–Medium |
| Base | Protected `dev-main` |
| Depends on | `fix/search-identity`, `fix/explicit-gallery-consent`, `feat/product-funnel-instrumentation` |
| Accountable roles | Growth/SEO + frontend + privacy + QA |

## Outcome

Build truthful, route-specific public acquisition surfaces on the corrected search identity and meet a measured mobile
acquisition budget.

## Evidence

Public routes reuse generic metadata, incubating CTAs can overstate readiness, locale acquisition is incomplete, and hero
images total about 6.2 MB unoptimized. Search-domain and environment isolation are owned by `fix/search-identity`.

## Scope

- Add route-specific title/description and real 1200×630 social output without changing the search-identity contract.
- Make every marketing CTA truthful about preview, disabled, incubating, and production-ready surfaces, including ArchBuilder.
- Convert hero assets to responsive AVIF/WebP and enforce measured mobile performance budgets.
- Index UGC/sample content only after explicit consent, moderation, revocation, and rights review.
- Publish complete `/tr` and `/en` locale routes before additional-language/hreflang expansion.

## Non-goals

No mass-generated SEO pages, fake ratings, paid campaign, or indexing of private critique/artifacts.

## Acceptance criteria

- [ ] Route metadata and OG previews are unique, correct, and accessible.
- [ ] ArchBuilder and other incubating surfaces are labelled as previews until their functional acceptance contracts pass.
- [ ] Consent revocation removes eligible UGC from public/indexable delivery according to policy.
- [ ] Mobile Lighthouse/Web Vitals meet the approved measured budget on representative hardware.
- [ ] The `fix/search-identity` deployed contract remains green throughout the rollout.

## Approval and migration boundary

Locale URL contract and UGC indexing require owner/privacy/SEO approval.

## Rollout

Validate the search-identity prerequisite → ship one truthful route/asset cohort → measure activation/performance → expand.

## Rollback

Restore the last correct route metadata/assets while retaining the search-identity and privacy prerequisites.

## Metrics and required artifacts

- Primary evidence: Canonical/index coverage errors, organic Studio activation, social preview correctness, measured LCP/asset bytes.
- Required PR artifacts: production-path tests, before/after evidence, rollout log, rollback proof, and updated contracts/docs.
- Closure requires the linked risk-register items to meet the global closure policy.
