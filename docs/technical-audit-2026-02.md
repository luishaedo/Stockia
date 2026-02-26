# Technical Audit Report — Stockia Monorepo

Date: 2026-02-26  
Scope: `apps/api`, `apps/web`, `packages/shared`, top-level build/test scripts and docs.

---

## 1) Executive Summary

The application has a solid baseline for a small-to-medium product:

- Clear monorepo structure (`api`, `web`, `shared`) and unified build flow.
- Runtime env validation in API startup.
- Authentication gate for operational routes.
- Shared contracts using Zod and shared error codes.
- Basic observability hooks (`/health`, `/metrics`, request logging).

Main risks are concentrated in:

1. **Security hardening gaps** (custom JWT, in-memory rate limiting, upload parser).  
2. **Scalability limits** for multi-instance deployments (in-memory caches/limits).  
3. **Maintenance debt** (legacy compatibility paths, manual dynamic Prisma delegates, weakly typed casts).  
4. **Testing strategy gaps** (partial scripts, old verification scripts not integrated into CI).

Overall maturity: **intermediate**, production-capable with important hardening work pending.

---

## 2) Technical Mapping

### 2.1 Monorepo architecture

- `apps/api`: Node + Express + Prisma backend.
- `apps/web`: Vite + React frontend.
- `packages/shared`: shared schemas/types/error codes.
- Root scripts orchestrate workspace build/dev/test.

### 2.2 Runtime and data layer

- API enforces required env values (`DATABASE_URL`, `JWT_SECRET`, auth credentials, limits).
- Prisma datasource is PostgreSQL-only.
- API starts only after successful DB connection.

### 2.3 API flows (critical)

1. **Authentication**  
   - `POST /auth/login` compares env username/password and issues token.
   - Protected routes require bearer token.

2. **Invoice lifecycle**  
   - `POST /facturas` creates draft.
   - `PATCH /facturas/:id/draft` updates draft with optimistic lock.
   - `PATCH /facturas/:id/finalize` finalizes with integrity checks.
   - `GET /facturas`, `GET /facturas/:id` list/detail.

3. **Admin data flows**  
   - Catalog CRUD routes under `/admin/catalogs/:catalog`.
   - Upload route for logos under `/admin/uploads/logo`.
   - Admin reporting routes (`/admin/invoices`, `/admin/invoice-users`).

4. **Operational catalogs for frontend**  
   - `GET /operations/catalogs` with API-side in-memory cache.

### 2.4 Frontend composition

- React router with protected routes.
- Auth state backed by `sessionStorage` token.
- Centralized `ApiService` with auth headers, error parsing, and local in-memory caches.

### 2.5 Contracts and validation

- Shared Zod schemas in `packages/shared` for DTOs and query validation.
- Shared error code constants consumed by API and frontend.
- Legacy-compatible payload handling documented for invoice v2 migration.

---

## 3) Validation of Current Project State

Checks executed during audit:

- Monorepo build (shared + api + web) succeeded.
- Workspace tests command executed (no configured tests in most workspaces).
- API auth-policy verification script passed.

Conclusion: **build health is good**, but **test depth is low** for regression prevention.

---

## 4) Risk Analysis by Category

### 4.1 Security risks

1. **Custom JWT implementation (high)**  
   Token issuance/verification is hand-rolled with HMAC and manual base64 parsing. This increases risk of subtle cryptographic/validation bugs versus hardened libraries.

2. **Credential model based on static env username/password (medium-high)**  
   Operationally simple but weak for enterprise contexts (no rotation workflow, no MFA, no per-user RBAC).

3. **In-memory rate limiter (medium)**  
   Works in single instance only. In multi-instance deployments requests bypass global limits.

4. **Manual multipart parser for uploads (medium-high)**  
   Custom parser handling boundary/segments can fail on edge payloads and is harder to secure than battle-tested middleware.

5. **Potential sensitive log leakage (medium)**  
   Request and API error logging is useful, but without strict redaction policy there is risk of exposing request details.

### 4.2 Scalability and reliability risks

1. **In-memory API cache for operation catalogs (medium)**  
   Cache not shared across instances; inconsistent freshness between pods.

2. **In-memory frontend catalog cache only (low-medium)**  
   Acceptable for UX, but stale data management is coarse and not coordinated with server invalidation.

3. **Synchronous cleanup interval in rate limiter (low-medium)**  
   Fine at low volume, but in-memory map growth in high-cardinality traffic can pressure memory.

### 4.3 Maintainability / technical debt

1. **Legacy field compatibility still active (medium)**  
   Multiple code paths (`proveedor`, `curvaTalles`, `marca`) increase complexity and validation branching.

2. **Dynamic Prisma delegate access by string (medium)**  
   `getModelDelegate` uses `unknown`/string model names, reducing type safety and refactor confidence.

3. **`any`/unsafe casts in repository/service (medium)**  
   Weakens compile-time guarantees and can hide contract drift.

4. **Large centralized API service in frontend (low-medium)**  
   Growing single service class can become a bottleneck for evolution and testability.

### 4.4 DX / quality process risks

1. **Old verification scripts not integrated into package scripts (medium)**  
   `verify-phase1/2/3.ts` appear disconnected from CI flow, making them prone to drift.

2. **Limited automated test coverage (high)**  
   Build success does not validate business invariants deeply.

3. **No lint workflow configured at app level (medium)**  
   Root has lint script, but workspaces do not define one consistently.

---

## 5) Obsolete Areas and Potential “Code Surplus”

> Note: This section flags candidates with evidence; no deletion was applied in this audit.

1. **Legacy compatibility layer (planned-obsolete)**
   - Legacy invoice fields are explicitly transitional in docs.
   - Service logs deprecation warnings for legacy usage.
   - Candidate cleanup after migration window closes.

2. **`verify-phase1.ts`, `verify-phase2.ts`, `verify-phase3.ts` (likely obsolete or unattended)**
   - Present in `apps/api/test-scripts`, but not wired in `package.json` scripts.
   - Risk: stale scripts giving false confidence.

3. **Route definition policy includes legacy endpoints (`/providers`, `/size-tables`)**
   - If frontend moved fully to `/operations/catalogs`, these may be deprecation candidates.
   - Requires usage telemetry before removal.

4. **Dual naming semantics in item payloads (`supplierLabel` vs `marca`)**
   - Adds normalization complexity and duplicate semantic fields.
   - Candidate removal in contract v3.

---

## 6) Improvement Plan (Complete Roadmap)

## Phase 0 — Immediate hardening (1–2 weeks)

1. **JWT hardening path**
   - Replace custom token implementation with a maintained JWT library.
   - Keep token payload contract unchanged to avoid breaking frontend.

2. **Upload endpoint hardening**
   - Replace manual multipart parsing with battle-tested middleware.
   - Enforce file signature checks and strict extension mapping.

3. **Observability baseline**
   - Add standard redaction rules for logs (auth headers, secrets, PII fields).
   - Add structured error metrics per endpoint and code.

4. **Quality gate quick wins**
   - Wire smoke/auth-policy checks in CI pipeline.
   - Add minimal lint configuration for API/Web/Shared.

## Phase 1 — Reliability and scalability (2–4 weeks)

1. **Distributed rate limiting**
   - Move from in-memory limiter to shared store (e.g., Redis-backed strategy).

2. **Shared cache strategy**
   - Move API operational catalogs cache to distributed cache or DB-level efficient query strategy.
   - Define explicit invalidation hooks on admin catalog mutations.

3. **Service decomposition in web API client**
   - Split `ApiService` by bounded context (`auth`, `facturas`, `admin-catalogs`, `admin-reporting`).

4. **Typed error normalization**
   - Standardize error envelope and remove legacy error parsing branch once backend confirms final format.

## Phase 2 — Contract cleanup and debt retirement (2–3 weeks)

1. **Remove legacy payload aliases**
   - Sunset `proveedor` and `curvaTalles` aliases after migration telemetry threshold.

2. **Remove dual semantic item fields**
   - Standardize only `supplierLabel` across write/read contracts.

3. **Refactor dynamic Prisma delegates**
   - Replace string-based dynamic delegate access with typed per-catalog handlers.

4. **Review old verification scripts**
   - Either integrate into CI as real tests or remove to reduce dead code.

## Phase 3 — Testing and governance (ongoing)

1. **Add integration tests for invoice lifecycle**
   - Draft create/update/finalize + optimistic lock + authorization matrix.

2. **Contract tests between `shared` schemas and API responses**
   - Ensure no drift between DTO schemas and runtime payloads.

3. **Architecture governance**
   - Add ADR for auth evolution, cache strategy, and deprecation policy timelines.

---

## 7) Prioritized Backlog (Impact vs Effort)

### High impact / low-medium effort (do first)

1. CI: include auth-policy + smoke scripts.
2. Log redaction policy.
3. Remove/mark obsolete verification scripts.
4. Add lint commands per workspace.

### High impact / medium effort

1. JWT library migration.
2. Upload middleware migration.
3. Distributed rate limit.

### High impact / high effort

1. Full legacy field deprecation and contract v3 rollout.
2. End-to-end integration test suite with seeded test DB and fixtures.

---

## 8) Suggested KPIs to Track Progress

1. Auth-related incident count / month.
2. P95 latency on `GET /facturas` and `GET /operations/catalogs`.
3. Error-rate by code (`AUTH_TOKEN_INVALID`, `VALIDATION_FAILED`, `INTERNAL_SERVER_ERROR`).
4. Test coverage for invoice lifecycle and admin catalog flows.
5. Legacy field usage percentage (`proveedor`, `curvaTalles`, `marca`).

---

## 9) Immediate Next Actions (proposed)

1. Approve Phase 0 implementation scope.
2. Decide legacy sunset timeline (2 releases vs 3 releases).
3. Choose strategy for upload and rate-limit hardening.
4. Open implementation PRs in this order:
   - PR-1: CI + lint + observability redaction.
   - PR-2: JWT + upload hardening.
   - PR-3: cache/rate-limit distributed strategy.
   - PR-4: legacy contract cleanup.

