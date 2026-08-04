# fix/search-identity

| Field | Value |
|---|---|
| Priority / phase | P1 / Phase 1 parallel foundation |
| Status | Planned; branch not created |
| DRI | UNASSIGNED — branch must not start |
| Approver | UNASSIGNED — required roles: product owner + SEO/privacy owner |
| Target | UNSET — intended inside the first 30 days |
| Decision gates | None — branch approval plus verified production domain/redirect ownership |
| Blocked until | Green source and protected delivery; it does not wait for acquisition experiments |
| Effort / delivery risk | S–M / Low–Medium |
| Base | Protected `dev-main` |
| Depends on | `fix/release-build-blockers`, `fix/repository-release-gates`; later HTTP hardening must preserve this contract |
| Accountable roles | SEO/growth + platform/frontend + privacy + QA |

## Outcome

Give production the correct canonical/search identity and prevent development traffic/data from contaminating it.

## Evidence

Production canonical, robots, sitemap, and Open Graph fallback reference `drawordie.ackaraca.me`; the sitemap exposes only
the stale root, development is indexable, and production/development share analytics defaults.

## Scope

- Set `https://drawordie.app` as production metadata base/self-canonical.
- Configure and verify one-hop permanent redirects from the legacy production domain.
- Produce one correct robots/sitemap source for existing approved public routes only.
- Apply dev/preview `noindex,nofollow` and separate analytics/configuration.
- Add deployed-environment canonical, robots, sitemap, redirect, noindex, and analytics tests.

## Non-goals

No JTBD content program, UGC indexing, localization expansion, hero redesign, or paid acquisition.

## Acceptance criteria

- [ ] Production routes use `drawordie.app`; legacy URLs redirect once to the intended route.
- [ ] One sitemap contains no stale/non-public URL and robots points to it.
- [ ] Dev/preview is non-indexable and cannot write production analytics.
- [ ] Private/gallery content is absent unless separately consented and approved.
- [ ] Deployed tests catch a stale domain or production analytics ID in non-production.

## Approval and migration boundary

Domain redirect and production metadata changes require domain owner approval. No existing public user content is added to
the sitemap in this branch.

## Rollout

Dev noindex/analytics separation → production metadata/sitemap → redirect verification → search-console submission.

## Rollback

Restore the last correct `drawordie.app` metadata configuration while retaining dev noindex and analytics isolation.

## Metrics and required artifacts

- Primary evidence: stale canonical/index target zero; environment analytics contamination zero.
- Required artifacts: deployed response snapshots, redirect map, sitemap diff, analytics environment test.
