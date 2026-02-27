# Security migration implementation plan (selected options)

Selected options for implementation:
- JWT migration: `jsonwebtoken` (HS256), preserving current payload/response contract.
- Multipart upload migration: `multer` with stricter file validation.
- Distributed rate limit: `express-rate-limit` + `rate-limit-redis` + Redis backend.

## Rollout and flags
- `AUTH_JWT_LIB_ENABLED`
- `UPLOAD_MIDDLEWARE_ENABLED`
- `RATE_LIMIT_REDIS_ENABLED`

Rollout sequence:
1. Stage (all flags off, then one-by-one on).
2. Canary in production (10%).
3. Full rollout (100%).

Rollback:
- Toggle migration flags back to `false` to restore previous implementation.

## Validation checklist
- `npm run prisma:generate -w api`
- `npm run build -w api`
- `npm run verify:auth-policy -w api`
- `npm run smoke:ci -w api`
- `npm run verify:security-contract -w api`

## Special note for this environment
The current execution environment rejects dependency downloads from external registries (HTTP 403), so package installation for:
- `jsonwebtoken`
- `multer`
- `express-rate-limit`
- `rate-limit-redis`
- `redis`

must be completed in an environment with package registry access before coding phases 1/2/3 can be finalized.
