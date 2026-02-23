# ADR 0001: PostgreSQL as Source of Truth

- Status: Accepted
- Date: 2026-02-23
- Decision owners: Backend + Platform maintainers

## Context

Stockia runs on Prisma with a relational database. Historical references to SQLite in docs and assumptions can create drift between local/dev and production behavior.

This drift increases risk in query semantics, migration behavior, and incident debugging.

## Decision

PostgreSQL is the sole source of truth for all environments:

- Local development
- Shared development
- Staging
- Production

All project-level database contracts (`DATABASE_URL`, Prisma provider, setup docs, automation scripts, and operational runbooks) must assume PostgreSQL.

SQLite is explicitly deprecated for this repository and must not be reintroduced in docs, examples, schema providers, or new tooling.

## Consequences

### Positive

- Environment parity from local to production.
- Predictable Prisma behavior and SQL capabilities.
- Reduced onboarding ambiguity.

### Trade-offs

- Local setup requires PostgreSQL availability (Docker or managed development database).
- Existing external notes/scripts that mention SQLite must be updated when encountered.

## Guardrails

- Any PR that introduces SQLite assumptions should be considered architecture policy regression.
- New setup guides must document PostgreSQL-only bootstrap.
- If a future migration away from PostgreSQL is needed, it must be approved through a new ADR.
