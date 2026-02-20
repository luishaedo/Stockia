# API Authentication Policy

This document defines authentication requirements per endpoint for the current API surface.

## Login

- Endpoint: `POST /auth/login`
- Body: `{ "username": "string", "password": "string" }`
- Success response: `{ "accessToken": "<token>", "tokenType": "Bearer" }`

## Header

- Header name: `Authorization`
- Format: `Bearer <accessToken>`
- Required for: write operations
- Token secret: `JWT_SECRET` in API runtime

## Endpoint matrix

| Method | Path | Auth required | Header | Notes |
| --- | --- | --- | --- | --- |
| GET | `/health` | No | N/A | Liveness endpoint |
| POST | `/auth/login` | No | N/A | Issues access token |
| GET | `/facturas` | Yes | `Authorization: Bearer <token>` | List/search facturas |
| GET | `/facturas/:id` | Yes | `Authorization: Bearer <token>` | Retrieve factura detail |
| POST | `/facturas` | Yes | `Authorization: Bearer <token>` | Creates draft factura |
| PATCH | `/facturas/:id/draft` | Yes | `Authorization: Bearer <token>` | Updates draft factura |
| PATCH | `/facturas/:id/finalize` | Yes | `Authorization: Bearer <token>` | Finalizes factura, requires `expectedUpdatedAt` |

## Error behavior

- Missing token on protected endpoints: `401 AUTH_TOKEN_MISSING`
- Invalid/expired token on protected endpoints: `403 AUTH_TOKEN_INVALID`
- Invalid credentials: `401 INVALID_CREDENTIALS`
- Missing auth server config: `500 INTERNAL_SERVER_ERROR`

## Consistency guard

A consistency script validates that every registered factura route has a corresponding policy entry and matching `requiresAdminToken` expectation.

Run:

```bash
npm run verify:auth-policy -w api
```
