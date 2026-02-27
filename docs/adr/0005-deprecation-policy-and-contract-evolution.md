# ADR 0005: Deprecation Policy and Contract Evolution

- Status: Accepted
- Date: 2026-02-27
- Decision owners: Backend + API governance maintainers

## Context

The API is in an active transition from legacy field names to IDs-first contracts (for example, `proveedor` -> `supplierId`, `curvaTalles` -> `sizeCurveId`).

Deprecations without governance can produce uncoordinated removals, breaking integrations and reducing confidence in release safety.

## Decision

Formalize deprecation governance for API contracts:

- Every deprecated field must have a documented replacement and compatibility window.
- During the window, server behavior keeps backward compatibility and emits deprecation signals in logs.
- Contract verification must preserve both expected replacement behavior and legacy compatibility behavior where applicable.
- Field removals require an ADR update and release notes communication.

## Consequences

### Positive

- Safer API evolution without sudden client breakage.
- Better observability of migration progress through deprecation logs.
- Shared understanding of timelines for contract cleanup.

### Trade-offs

- Temporary dual-field support increases implementation complexity.
- Verification scope grows while transition windows are open.

## Guardrails

- No deprecated field removal without passing through governance review.
- Shared package contracts and API docs must stay aligned with active deprecations.
- Each deprecation must define: replacement, end-of-support target, and test coverage impact.
