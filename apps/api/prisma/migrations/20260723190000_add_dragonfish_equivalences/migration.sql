-- CreateTable
CREATE TABLE "DragonfishEquivalence" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "colorCode" TEXT NOT NULL,
    "dragonfishCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DragonfishEquivalence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DragonfishEquivalence_dragonfishCode_key"
ON "DragonfishEquivalence"("dragonfishCode");

-- CreateIndex
CREATE UNIQUE INDEX "DragonfishEquivalence_articleId_colorCode_key"
ON "DragonfishEquivalence"("articleId", "colorCode");

-- CreateIndex
CREATE INDEX "DragonfishEquivalence_articleId_idx"
ON "DragonfishEquivalence"("articleId");

-- CreateIndex
CREATE INDEX "DragonfishEquivalence_colorCode_idx"
ON "DragonfishEquivalence"("colorCode");

-- CreateIndex
CREATE INDEX "DragonfishEquivalence_updatedAt_idx"
ON "DragonfishEquivalence"("updatedAt");

-- AddForeignKey
ALTER TABLE "DragonfishEquivalence"
ADD CONSTRAINT "DragonfishEquivalence_articleId_fkey"
FOREIGN KEY ("articleId") REFERENCES "Article"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
