-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarmentType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classification" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "longDescription" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SizeCurve" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SizeCurve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SizeCurveValue" (
    "id" TEXT NOT NULL,
    "sizeCurveId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "SizeCurveValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");
CREATE INDEX "Supplier_code_idx" ON "Supplier"("code");
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Family_code_key" ON "Family"("code");
CREATE INDEX "Family_code_idx" ON "Family"("code");
CREATE INDEX "Family_description_idx" ON "Family"("description");

-- CreateIndex
CREATE UNIQUE INDEX "GarmentType_code_key" ON "GarmentType"("code");
CREATE INDEX "GarmentType_code_idx" ON "GarmentType"("code");
CREATE INDEX "GarmentType_description_idx" ON "GarmentType"("description");

-- CreateIndex
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");
CREATE INDEX "Material_code_idx" ON "Material"("code");
CREATE INDEX "Material_description_idx" ON "Material"("description");

-- CreateIndex
CREATE UNIQUE INDEX "Classification_code_key" ON "Classification"("code");
CREATE INDEX "Classification_code_idx" ON "Classification"("code");
CREATE INDEX "Classification_description_idx" ON "Classification"("description");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");
CREATE INDEX "Category_code_idx" ON "Category"("code");
CREATE INDEX "Category_description_idx" ON "Category"("description");

-- CreateIndex
CREATE UNIQUE INDEX "SizeCurve_code_key" ON "SizeCurve"("code");
CREATE INDEX "SizeCurve_code_idx" ON "SizeCurve"("code");
CREATE INDEX "SizeCurve_description_idx" ON "SizeCurve"("description");

-- CreateIndex
CREATE INDEX "SizeCurveValue_sizeCurveId_idx" ON "SizeCurveValue"("sizeCurveId");
CREATE UNIQUE INDEX "SizeCurveValue_sizeCurveId_value_key" ON "SizeCurveValue"("sizeCurveId", "value");
CREATE UNIQUE INDEX "SizeCurveValue_sizeCurveId_sortOrder_key" ON "SizeCurveValue"("sizeCurveId", "sortOrder");

-- AddForeignKey
ALTER TABLE "SizeCurveValue" ADD CONSTRAINT "SizeCurveValue_sizeCurveId_fkey" FOREIGN KEY ("sizeCurveId") REFERENCES "SizeCurve"("id") ON DELETE CASCADE ON UPDATE CASCADE;
