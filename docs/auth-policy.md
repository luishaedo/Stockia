# API Authentication Policy

This document defines authentication requirements for the full active API surface.

## Login

- Endpoint: `POST /auth/login`
- Body: `{ "username": "string", "password": "string" }`
- Success response: `{ "accessToken": "<token>", "tokenType": "Bearer" }`

## Header

- Header name: `Authorization`
- Format: `Bearer <accessToken>`
- Required for: every protected endpoint listed in the matrix below
- Token secret: `JWT_SECRET` in API runtime

## Endpoint matrix

| Method | Path | Auth required | Header | Notes |
| --- | --- | --- | --- | --- |
| GET | `/health` | No | N/A | Liveness endpoint |
| GET | `/metrics` | No | N/A | Prometheus metrics |
| POST | `/auth/login` | No | N/A | Issues access token |
| GET | `/facturas` | Yes | `Authorization: Bearer <token>` | List/search facturas |
| GET | `/facturas/:id` | Yes | `Authorization: Bearer <token>` | Retrieve factura detail |
| POST | `/facturas` | Yes | `Authorization: Bearer <token>` | Creates draft factura |
| PATCH | `/facturas/:id/draft` | Yes | `Authorization: Bearer <token>` | Updates draft factura |
| PATCH | `/facturas/:id/finalize` | Yes | `Authorization: Bearer <token>` | Finalizes factura |
| GET | `/admin/invoices` | Yes | `Authorization: Bearer <token>` | Admin invoice listing |
| GET | `/admin/invoice-users` | Yes | `Authorization: Bearer <token>` | Admin invoice users listing |
| GET | `/admin/catalogs/:catalog` | Yes | `Authorization: Bearer <token>` | Admin catalog listing |
| GET | `/admin/catalogs/:catalog/version` | Yes | `Authorization: Bearer <token>` | Catalog cache version |
| POST | `/admin/catalogs/:catalog` | Yes | `Authorization: Bearer <token>` | Create catalog item |
| PUT | `/admin/catalogs/:catalog/:id` | Yes | `Authorization: Bearer <token>` | Update catalog item |
| DELETE | `/admin/catalogs/:catalog/:id` | Yes | `Authorization: Bearer <token>` | Delete catalog item |
| POST | `/admin/uploads/logo` | Yes | `Authorization: Bearer <token>` | Upload catalog logo |
| GET | `/operations/catalogs` | Yes | `Authorization: Bearer <token>` | Operational catalogs for UI |
| GET | `/operations/catalogs/version` | Yes | `Authorization: Bearer <token>` | Operations catalog cache version |
| GET | `/providers` | Yes | `Authorization: Bearer <token>` | Legacy providers alias |
| GET | `/size-tables` | Yes | `Authorization: Bearer <token>` | Legacy size tables alias |
| GET | `/uploads/*` | No | N/A | Static files, publicly served |

## Error behavior

- Missing token on protected endpoints: `401 AUTH_TOKEN_MISSING`
- Invalid/expired token on protected endpoints: `403 AUTH_TOKEN_INVALID`
- Invalid credentials: `401 INVALID_CREDENTIALS`
- Missing auth server config: `500 INTERNAL_SERVER_ERROR`

## Governance checks

The repository includes consistency scripts to avoid auth and contract drift.

```bash
npm run verify:auth-policy -w api
npm run verify:route-contracts -w api
```

## Product evolution notes

- RBAC is a pending evolution item: current policy is single-role (`admin`) by design.
- Audit trail by catalog/invoice action is also pending and should be implemented together with RBAC scopes to avoid duplicated migration effort.
