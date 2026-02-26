-- Backfill InvoiceUser rows from legacy Factura.createdBy values
INSERT INTO "InvoiceUser" ("id", "externalId", "name", "createdAt", "updatedAt")
SELECT
    concat('legacy-', md5(trimmed_created_by)),
    trimmed_created_by,
    trimmed_created_by,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT trim("createdBy") AS trimmed_created_by
    FROM "Factura"
    WHERE "createdBy" IS NOT NULL
      AND trim("createdBy") <> ''
      AND "createdByUserId" IS NULL
) AS candidates
WHERE NOT EXISTS (
    SELECT 1
    FROM "InvoiceUser" iu
    WHERE iu."externalId" = candidates.trimmed_created_by
);

-- Backfill Factura.createdByUserId where it is still null
UPDATE "Factura" f
SET "createdByUserId" = iu."id"
FROM "InvoiceUser" iu
WHERE f."createdByUserId" IS NULL
  AND f."createdBy" IS NOT NULL
  AND trim(f."createdBy") <> ''
  AND iu."externalId" = trim(f."createdBy");
