-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "classificationId" TEXT NOT NULL,
    "garmentTypeId" TEXT NOT NULL,
    "sizeCurveId" TEXT NOT NULL,
    "baseArticleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "FacturaItem"
ADD COLUMN "articleId" TEXT,
ADD COLUMN "articleSnapshot" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "Article_supplierId_sku_key" ON "Article"("supplierId", "sku");
CREATE INDEX "Article_sku_idx" ON "Article"("sku");
CREATE INDEX "Article_supplierId_idx" ON "Article"("supplierId");
CREATE INDEX "Article_familyId_idx" ON "Article"("familyId");
CREATE INDEX "Article_materialId_idx" ON "Article"("materialId");
CREATE INDEX "Article_categoryId_idx" ON "Article"("categoryId");
CREATE INDEX "Article_classificationId_idx" ON "Article"("classificationId");
CREATE INDEX "Article_garmentTypeId_idx" ON "Article"("garmentTypeId");
CREATE INDEX "Article_sizeCurveId_idx" ON "Article"("sizeCurveId");
CREATE INDEX "FacturaItem_articleId_idx" ON "FacturaItem"("articleId");

-- AddForeignKey
ALTER TABLE "FacturaItem" ADD CONSTRAINT "FacturaItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "Classification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_garmentTypeId_fkey" FOREIGN KEY ("garmentTypeId") REFERENCES "GarmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_sizeCurveId_fkey" FOREIGN KEY ("sizeCurveId") REFERENCES "SizeCurve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_baseArticleId_fkey" FOREIGN KEY ("baseArticleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
