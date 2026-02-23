ALTER TABLE "Factura" ADD COLUMN "createdBy" TEXT;

CREATE INDEX "Factura_createdBy_idx" ON "Factura"("createdBy");
