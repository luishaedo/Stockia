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
