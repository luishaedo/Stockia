#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${MIGRATION_ID:-}" ]]; then
  echo "Usage: MIGRATION_ID=<migration_folder_name> DATABASE_URL=<postgres_url> $0"
  echo "Example: MIGRATION_ID=20260327120000_add_quick_curves DATABASE_URL=postgres://... $0"
  exit 1
fi

echo "[1/3] Marking failed migration as rolled back in _prisma_migrations..."
npx prisma migrate resolve --rolled-back "$MIGRATION_ID"

echo "[2/3] Re-applying pending migrations..."
npx prisma migrate deploy

echo "[3/3] Done."
