# Legacy deprecation policy (Release N)

This document defines the retirement governance for legacy aliases and endpoints introduced in the API catalog surface.

## Timeline strategy

- **Release N (announce):** add deprecation headers + telemetry.
- **Release N+1 (enforce):** keep compatibility, monitor consumers, enable canary disablement.
- **Release N+2 (remove):** remove aliases/endpoints that satisfy the agreed threshold.

## Threshold decision

Selected threshold: **Option B (balanced)**.

An alias can be removed when:

- traffic remains **< 3%** during **21 consecutive days**;
- no tier-1 consumer is detected in telemetry;
- no unresolved escalation exists in support/incident channels.

## Legacy route registry

| route_name | migration_target | introduced_at | deprecated_at | sunset_at | owner | rollback_strategy |
| --- | --- | --- | --- | --- | --- | --- |
| POST /auth/login | POST /api/auth/login | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| GET /facturas | GET /api/facturas | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| GET /facturas/:id | GET /api/facturas/:id | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| POST /facturas | POST /api/facturas | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| PATCH /facturas/:id/draft | PATCH /api/facturas/:id/draft | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| PATCH /facturas/:id/finalize | PATCH /api/facturas/:id/finalize | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| GET /admin/invoices | GET /api/admin/invoices | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| GET /admin/invoice-users | GET /api/admin/invoice-users | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| GET /admin/catalogs/:catalog | GET /api/admin/catalogs/:catalog | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| GET /admin/catalogs/:catalog/version | GET /api/admin/catalogs/:catalog/version | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| POST /admin/catalogs/:catalog | POST /api/admin/catalogs/:catalog | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| PUT /admin/catalogs/:catalog/:id | PUT /api/admin/catalogs/:catalog/:id | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| DELETE /admin/catalogs/:catalog/:id | DELETE /api/admin/catalogs/:catalog/:id | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| POST /admin/uploads/logo | POST /api/admin/uploads/logo | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| GET /operations/catalogs | GET /api/operations/catalogs | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| GET /operations/catalogs/version | GET /api/operations/catalogs/version | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| GET /articles/search | GET /api/articles/search | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| POST /articles | POST /api/articles | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| POST /articles/:id/clone | POST /api/articles/:id/clone | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| GET /admin/articles/import/template | GET /api/admin/articles/import/template | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| POST /admin/articles/import/preview | POST /api/admin/articles/import/preview | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| POST /admin/articles/import/commit | POST /api/admin/articles/import/commit | 2026-03-18 | 2026-03-18 | 2026-09-30 | API Platform | Keep legacy root alias with deprecation headers until consumer traffic is below threshold |
| GET /providers | GET /operations/catalogs (suppliers) | 2026-01-10 | 2026-02-27 | 2026-05-01 | API Platform | Re-enable route behind feature flag from previous release artifact |
| GET /size-tables | GET /operations/catalogs (curves) | 2026-01-10 | 2026-02-27 | 2026-05-01 | API Platform | Re-enable route behind feature flag from previous release artifact |

## Runtime signaling

All deprecated routes must emit:

- `Deprecation: true`
- `Sunset: <RFC-1123 date>`
- Optional `Link: <migration-doc>; rel="deprecation"`

## Telemetry contract for legacy usage

For each deprecated alias request, export metric labels:

- `route_name`
- `alias_name`
- `consumer_id`
- `status_code`

For quality/safety tracking, also collect:

- request volume trends
- error counter trends
- latency (via existing route histogram)

## Exit criteria

- Sunset approved by engineering and product.
- Every legacy route has owner + migration target + rollback strategy.
- Consumer communications completed before N+2 deletion.
