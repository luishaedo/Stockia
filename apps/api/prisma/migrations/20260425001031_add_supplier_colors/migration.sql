-- CreateTable
CREATE TABLE "SupplierColor" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierColor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierColor_supplierId_idx" ON "SupplierColor"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierColor_code_idx" ON "SupplierColor"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierColor_supplierId_code_key" ON "SupplierColor"("supplierId", "code");

-- AddForeignKey
ALTER TABLE "SupplierColor" ADD CONSTRAINT "SupplierColor_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
