# Stockia Monorepo

Stockia is organized as a monorepo with a backend API, a frontend web application, and shared contracts.

## Repository structure

- `apps/api`: Node.js + Express + Prisma API.
- `apps/web`: Vite + React frontend.
- `packages/shared`: Shared types, Zod schemas, and API error codes.

## Prerequisites

- Node.js 18+
- npm 9+

## Setup

1. Install dependencies from the repository root:

```bash
npm install
```

2. Configure backend environment:

```bash
cp apps/api/.env.example apps/api/.env
```

Recommended local values:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/stockia?schema=public"
PORT=4000
JWT_SECRET="change-me-with-long-random-secret"
AUTH_USERNAME=admin
AUTH_PASSWORD=change-me
CORS_ALLOWED_ORIGINS="http://localhost:5173"
CORS_ALLOW_NO_ORIGIN=false
RATE_LIMIT_READ_MAX=120
RATE_LIMIT_WRITE_MAX=30
RATE_LIMIT_LOGIN_MAX=10
```

3. Configure frontend environment:

```bash
cp apps/web/.env.example apps/web/.env
```

4. Generate Prisma client (required before backend build/start):

```bash
npm run prisma:generate -w api
```


## Production readiness

### API boot validation

On startup, the API validates critical environment variables and fails fast if any required value is missing or invalid:

- `DATABASE_URL`
- `JWT_SECRET`
- `AUTH_USERNAME`
- `AUTH_PASSWORD`
- numeric limits (`PORT`, `RATE_LIMIT_*`)

The server also attempts a database connection before binding the HTTP port, so startup failures are visible immediately in logs.

## Commands by app

### Monorepo root

- Build everything:

```bash
npm run build
```

- Start all available dev servers:

```bash
npm run dev
```

### Backend (`apps/api`)

- Development mode:

```bash
npm run dev -w api
```

- Build:

```bash
npm run build -w api
```

- Start compiled app:

```bash
npm run start -w api
```

- Generate Prisma client:

```bash
npm run prisma:generate -w api
```

- Push Prisma schema:

```bash
npm run prisma:push -w api
```

- Verify auth policy coverage:

```bash
npm run verify:auth-policy -w api
```

- Run API smoke checks (requires built API):

```bash
npm run smoke:ci -w api
```

### Frontend (`apps/web`)

- Development mode:

```bash
npm run dev -w web
```

- Build (primary validation command):

```bash
npm run build -w web
```

- Preview production build:

```bash
npm run preview -w web
```

## Environment matrix

| Environment | API (`apps/api`) | Web (`apps/web`) | Notes |
| --- | --- | --- | --- |
| Local | `DATABASE_URL=postgresql://...`, `PORT=4000`, `JWT_SECRET`, `AUTH_USERNAME`, `AUTH_PASSWORD` | `VITE_API_URL` optional (fallback: `http://localhost:4000`) | If `VITE_API_URL` is not set, frontend uses localhost fallback. |
| Dev | Managed DB URL, `PORT`, secured `JWT_SECRET` and auth credentials | Set `VITE_API_URL` to dev API URL | Keep secrets out of source control. |
| Stage | Stage DB URL, stage port/auth secrets | Stage API URL | Mirror production as close as possible. |
| Prod | Production DB URL, hardened auth policy and secret rotation | `VITE_API_URL` is mandatory | Frontend fails fast if `VITE_API_URL` is missing. |

## Troubleshooting

### Frontend fails with missing env variables

- Ensure `apps/web/.env` exists.
- Authenticate against `POST /auth/login` to get bearer token for all factura operations (read/write).
- In production builds, `VITE_API_URL` is mandatory.

### API rejects factura operations with 401/403

- Verify `JWT_SECRET`, `AUTH_USERNAME`, and `AUTH_PASSWORD` in `apps/api/.env`.
- Ensure clients authenticate via `POST /auth/login` and use `Authorization: Bearer <token>`.

### Prisma client errors

- Re-run:

```bash
npm run prisma:generate -w api
```

### Port conflicts

- Default API port is `4000`.
- Change `PORT` in `apps/api/.env` and update `VITE_API_URL` accordingly.


## Deployment

### Render (API)

This repository includes `render.yaml` for a production API service.

- Build command: `npm ci && npm run build -w @stockia/shared && npm run build -w api`
- Start command: `npm run start -w api`
- Health check: `GET /health`

Required API environment variables on Render:

- `DATABASE_URL`
- `JWT_SECRET`
- `AUTH_USERNAME`
- `AUTH_PASSWORD`
- `CORS_ALLOWED_ORIGINS` (set to your Vercel domain)

Recommended:

- `CORS_ALLOW_NO_ORIGIN=false`
- `RATE_LIMIT_READ_MAX=120`
- `RATE_LIMIT_WRITE_MAX=30`
- `RATE_LIMIT_LOGIN_MAX=10`

### Vercel (Web)

Use the **repository root** as project root for monorepo builds.

- Root Directory: `.` (repo root)
- Install Command: `npm install --include=dev --workspaces`
- Build Command: `npm run build -w @stockia/shared && npm run build -w web`
- Output Directory: `apps/web/dist`
- Required env: `VITE_API_URL=https://<your-render-api-domain>`

This repo now includes root `vercel.json` with those defaults and SPA rewrites for React Router.

### Production checklist

- API is reachable at `https://<render-service>/health`.
- Web can authenticate through `POST /auth/login`.
- `CORS_ALLOWED_ORIGINS` exactly matches the Vercel origin.
- `VITE_API_URL` points to the Render API HTTPS URL.
- No secrets are committed; all credentials are set in platform environment variables.

