ALTER TABLE "Factura"
ADD COLUMN "supplierSnapshot" JSONB;

ALTER TABLE "FacturaItem"
ADD COLUMN "garmentTypeSnapshot" JSONB,
ADD COLUMN "sizeCurveSnapshot" JSONB;
