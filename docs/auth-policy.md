# API Authentication Policy

This document defines authentication requirements for the full active API surface. As of the current policy, all write operations require authentication unless explicitly exempted (for example `POST /auth/login`).

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
| GET | `/facturas` | No | N/A | List/search facturas |
| GET | `/facturas/:id` | No | N/A | Retrieve factura detail |
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
| POST | `/articles` | Yes | `Authorization: Bearer <token>` | Create article |
| POST | `/articles/:id/clone` | Yes | `Authorization: Bearer <token>` | Clone article |
| GET | `/admin/articles/import/template` | Yes | `Authorization: Bearer <token>` | Download article import template |
| POST | `/admin/articles/import/preview` | Yes | `Authorization: Bearer <token>` | Validate article import file |
| POST | `/admin/articles/import/commit` | Yes | `Authorization: Bearer <token>` | Persist article import rows |
| GET | `/operations/catalogs` | No | N/A | Operational catalogs for UI |
| GET | `/operations/catalogs/version` | No | N/A | Operations catalog cache version |
| GET | `/providers` | No | N/A | Legacy providers alias |
| GET | `/size-tables` | No | N/A | Legacy size tables alias |
| GET | `/articles/search` | No | N/A | Search articles |
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
