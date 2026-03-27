CREATE TABLE "QuickCurve" (
    "id" TEXT NOT NULL,
    "sizeCurveId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    CONSTRAINT "QuickCurve_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuickCurveValue" (
    "id" TEXT NOT NULL,
    "quickCurveId" TEXT NOT NULL,
    "sizeKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "QuickCurveValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuickCurve_sizeCurveId_code_key" ON "QuickCurve"("sizeCurveId", "code");
CREATE INDEX "QuickCurve_sizeCurveId_idx" ON "QuickCurve"("sizeCurveId");
CREATE UNIQUE INDEX "QuickCurveValue_quickCurveId_sizeKey_key" ON "QuickCurveValue"("quickCurveId", "sizeKey");
CREATE UNIQUE INDEX "QuickCurveValue_quickCurveId_sortOrder_key" ON "QuickCurveValue"("quickCurveId", "sortOrder");
CREATE INDEX "QuickCurveValue_quickCurveId_idx" ON "QuickCurveValue"("quickCurveId");

ALTER TABLE "QuickCurve" ADD CONSTRAINT "QuickCurve_sizeCurveId_fkey" FOREIGN KEY ("sizeCurveId") REFERENCES "SizeCurve"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuickCurveValue" ADD CONSTRAINT "QuickCurveValue_quickCurveId_fkey" FOREIGN KEY ("quickCurveId") REFERENCES "QuickCurve"("id") ON DELETE CASCADE ON UPDATE CASCADE;
