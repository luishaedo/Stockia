# Log redaction policy

## Objective

Prevent leakage of sensitive information in application, tooling, and CI/runtime logs.

## Mandatory rules

Never log plaintext values for:

- `Authorization`
- `Cookie` / `Set-Cookie`
- access tokens, JWTs, API keys
- passwords
- secrets
- credentials

These rules apply to:

- Backend application logs
- Automation and verification scripts
- CI and infrastructure-related logs/configuration emitted by repository scripts

## Implementation baseline

- Centralized log sanitization in `apps/api/src/lib/redaction.ts`.
- Logger sanitizes message and payload before serialization.
- Smoke checks validate absence of bearer tokens and unredacted sensitive key/value pairs.
- Static verification script checks for forbidden logging patterns.

## Allowed examples

- Logging metadata (`traceId`, `statusCode`, `path`, latency).
- Logging redacted placeholders (`[REDACTED]`).

## Forbidden examples

- Logging raw request headers containing `authorization`.
- Logging raw cookies or credential payloads.
- Logging full JWT/token strings.

## Validation

- `npm run verify:log-policy -w api`
- `npm run smoke:ci -w api`
