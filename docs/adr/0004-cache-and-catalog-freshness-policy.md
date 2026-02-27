# ADR 0004: Cache and Catalog Freshness Policy

- Status: Accepted
- Date: 2026-02-27
- Decision owners: Backend + Web maintainers

## Context

The application uses operational catalogs and admin-managed references. Reads are frequent while write operations are relatively constrained.

Without explicit cache governance, there is risk of stale catalog data, inconsistent invoice composition, and unclear invalidation expectations across backend and frontend.

## Decision

Establish a cache policy centered on correctness-first behavior for invoice operations:

- Invoice write paths (`create`, `draft update`, `finalize`) must always operate on authoritative backend state.
- Cached catalog data is allowed for UX acceleration, but must be invalidated on admin catalog mutations.
- Contract checks should validate catalog response shape through shared schemas before cache hydration.
- Cache freshness windows must be short-lived by default and overrideable by explicit feature policy.

## Consequences

### Positive

- Lower risk of stale data affecting invoice integrity.
- Predictable invalidation strategy for admin catalog updates.
- Stronger consistency between frontend cache and backend contracts.

### Trade-offs

- More cache invalidation events after admin writes.
- Potentially higher read load when freshness windows are conservative.

## Guardrails

- Any new cache layer must document TTL and invalidation triggers.
- Admin catalog write endpoints must trigger cache refresh/invalidation semantics.
- Schema validation with `@stockia/shared` remains mandatory before cache persistence.
