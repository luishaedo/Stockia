# API Authentication Policy

This document defines authentication requirements per endpoint for the current API surface.

## Header

- Header name: `x-admin-token`
- Required for: write operations
- Value source: `ADMIN_TOKEN` environment variable in the API runtime

## Endpoint matrix

| Method | Path | Auth required | Header | Notes |
| --- | --- | --- | --- | --- |
| GET | `/health` | No | N/A | Liveness endpoint |
| GET | `/facturas` | No | N/A | List/search facturas |
| GET | `/facturas/:id` | No | N/A | Retrieve factura detail |
| POST | `/facturas` | Yes | `x-admin-token` | Creates draft factura |
| PATCH | `/facturas/:id/draft` | Yes | `x-admin-token` | Updates draft factura |
| PATCH | `/facturas/:id/finalize` | Yes | `x-admin-token` | Finalizes factura |

## Error behavior

- Missing token on protected endpoints: `401 UNAUTHORIZED`
- Invalid token on protected endpoints: `403 FORBIDDEN`
- Missing `ADMIN_TOKEN` server config: `500 INTERNAL_SERVER_ERROR`

## Consistency guard

A consistency script validates that every registered factura route has a corresponding policy entry and matching `requiresAdminToken` expectation.

Run:

```bash
npm run verify:auth-policy -w api
```
