# Security migration contract baseline

This document freezes the API contract that must be preserved while migrating auth/upload/rate-limit internals.

## 1) Auth contract: `POST /auth/login`

### Request
- Method: `POST`
- Path: `/auth/login`
- Header: `Content-Type: application/json`
- Body:

```json
{
  "username": "<string>",
  "password": "<string>"
}
```

### Success response
- Status: `200`
- Body:

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer"
}
```

### Error responses
- `500` + `INTERNAL_SERVER_ERROR` + `Server misconfigured` if auth env is missing.
- `401` + `INVALID_CREDENTIALS` + `Invalid credentials` when credentials are wrong.

## 2) JWT payload contract

Current payload shape:

```json
{
  "sub": "<username>",
  "role": "admin",
  "exp": 1234567890
}
```

### Semantics
- `role` must remain exactly `admin`.
- `sub` must remain a string identity.
- `exp` remains seconds since epoch and token is invalid when `exp < now`.
- Signature algorithm stays `HS256`.

## 3) Upload contract: `POST /admin/uploads/logo`

### Request
- Method: `POST`
- Path: `/admin/uploads/logo`
- Auth: `Authorization: Bearer <token>`
- Content type: `multipart/form-data`
- Required field: `file`

### Success response
- Status: `201`
- Body:

```json
{
  "url": "/uploads/logos/<filename>",
  "mimeType": "image/png"
}
```

### Error responses (must be preserved)
- `400` + `VALIDATION_FAILED` + `Content-Type must be multipart/form-data`
- `400` + `VALIDATION_FAILED` + `Field file is required and must be PNG, JPG, WEBP or SVG`
- `400` + `VALIDATION_FAILED` + `Logo file exceeds 4MB limit`
- `500` + `INTERNAL_SERVER_ERROR` + `Could not upload logo`

## 4) No-regression metrics and acceptance targets

### Status-code invariants
- Keep `401` for missing bearer token.
- Keep `403` for invalid bearer token.
- Keep `429` for rate-limited requests.
- Preserve upload and login codes listed above.

### Error message invariants
- Preserve key messages:
  - `Missing bearer token`
  - `Invalid authentication token`
  - `Invalid credentials`
  - Upload validation/internal messages listed above.

### Header invariants
- Security headers remain present:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `X-DNS-Prefetch-Control: off`
  - `Strict-Transport-Security: max-age=15552000; includeSubDomains`

### Operational observability
- Track request/error counters and ensure:
  - `401`/`403` rate does not spike abnormally after migration.
  - `429` percentage remains within expected baseline.
  - upload failure rate remains stable.
  - p95 latency remains within baseline tolerance.
