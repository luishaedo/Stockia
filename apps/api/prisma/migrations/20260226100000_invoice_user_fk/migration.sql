-- CreateTable
CREATE TABLE "InvoiceUser" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceUser_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Factura"
ADD COLUMN "createdByUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceUser_externalId_key" ON "InvoiceUser"("externalId");
CREATE INDEX "InvoiceUser_externalId_idx" ON "InvoiceUser"("externalId");
CREATE INDEX "InvoiceUser_name_idx" ON "InvoiceUser"("name");
CREATE INDEX "Factura_createdByUserId_idx" ON "Factura"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Factura"
ADD CONSTRAINT "Factura_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "InvoiceUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
