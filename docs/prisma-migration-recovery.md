# Prisma production recovery for failed migration (P3009)

When `prisma migrate deploy` fails with `P3009`, Prisma blocks all new migrations until the failed migration is resolved.

Example error:

- Failed migration: `20260327120000_add_quick_curves`
- Error code: `P3009`

## Safe recovery workflow (PostgreSQL / Neon / Render)

> Run this only against the production database URL used by Render.

1. Open a Render shell (or local shell with `DATABASE_URL` pointing to production).
2. Mark the failed migration as rolled back:

```bash
cd apps/api
MIGRATION_ID=20260327120000_add_quick_curves npm run prisma:migrate:recover
```

The script executes:

```bash
npx prisma migrate resolve --rolled-back <MIGRATION_ID>
npx prisma migrate deploy
```

## If migration objects were partially created

If the first attempt left partial objects in PostgreSQL, clean them before re-running deploy.

```sql
DROP TABLE IF EXISTS "QuickCurveValue";
DROP TABLE IF EXISTS "QuickCurve";
```

Then run:

```bash
cd apps/api
MIGRATION_ID=20260327120000_add_quick_curves npm run prisma:migrate:recover
```

## Verification

Use Prisma status to confirm there are no failed migrations left:

```bash
cd apps/api
npx prisma migrate status
```

Expected result: migration history is up to date and no failed migrations are reported.
