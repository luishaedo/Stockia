# ADR 0003: Security Verification Governance Baseline

- Status: Accepted
- Date: 2026-02-27
- Decision owners: Backend + Security maintainers

## Context

Authentication, authorization checks, and security headers already exist in the API, but governance was partially distributed across implementation details and ad-hoc scripts.

Without a clear baseline, security regressions can bypass routine verification when routes, middlewares, or policies evolve.

## Decision

Adopt a governance baseline where security-critical behavior is continuously validated through explicit verification scripts and policy documents.

The baseline requires:

- Auth guard validation for protected routes (`401` on missing token, `403` on invalid token).
- Security contract checks aligned with shared error codes.
- Traceable policy docs for auth, logging redaction, and route-level protection.
- Verification scripts versioned with the code and executed in CI/local quality gates.

## Consequences

### Positive

- Clear and repeatable security expectations.
- Faster regression detection when changing middleware or route protection.
- Better auditability across policy docs and executable checks.

### Trade-offs

- Additional maintenance burden for verification scripts.
- Security policy updates must be synchronized with script behavior.

## Guardrails

- Any new protected route must include auth and contract verification coverage.
- Shared error code contracts (`@stockia/shared`) are normative for auth failures.
- Security behavior changes require either script updates or an explicit ADR amendment.
