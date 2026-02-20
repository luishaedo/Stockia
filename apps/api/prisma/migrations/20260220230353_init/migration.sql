-- CreateEnum
CREATE TYPE "FacturaEstado" AS ENUM ('DRAFT', 'FINAL');

-- CreateTable
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL,
    "nroFactura" TEXT NOT NULL,
    "proveedor" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "FacturaEstado" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaItem" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "tipoPrenda" TEXT NOT NULL,
    "codigoArticulo" TEXT NOT NULL,
    "curvaTalles" TEXT[],

    CONSTRAINT "FacturaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaItemColor" (
    "id" TEXT NOT NULL,
    "facturaItemId" TEXT NOT NULL,
    "codigoColor" TEXT NOT NULL,
    "nombreColor" TEXT NOT NULL,
    "cantidadesPorTalle" JSONB NOT NULL,

    CONSTRAINT "FacturaItemColor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Factura_nroFactura_key" ON "Factura"("nroFactura");

-- CreateIndex
CREATE INDEX "Factura_estado_idx" ON "Factura"("estado");

-- CreateIndex
CREATE INDEX "Factura_fecha_idx" ON "Factura"("fecha");

-- CreateIndex
CREATE INDEX "Factura_nroFactura_idx" ON "Factura"("nroFactura");

-- CreateIndex
CREATE INDEX "Factura_proveedor_idx" ON "Factura"("proveedor");

-- CreateIndex
CREATE INDEX "Factura_estado_fecha_idx" ON "Factura"("estado", "fecha");

-- CreateIndex
CREATE INDEX "FacturaItem_facturaId_idx" ON "FacturaItem"("facturaId");

-- CreateIndex
CREATE UNIQUE INDEX "FacturaItem_facturaId_marca_tipoPrenda_codigoArticulo_key" ON "FacturaItem"("facturaId", "marca", "tipoPrenda", "codigoArticulo");

-- CreateIndex
CREATE INDEX "FacturaItemColor_facturaItemId_idx" ON "FacturaItemColor"("facturaItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FacturaItemColor_facturaItemId_codigoColor_key" ON "FacturaItemColor"("facturaItemId", "codigoColor");

-- AddForeignKey
ALTER TABLE "FacturaItem" ADD CONSTRAINT "FacturaItem_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaItemColor" ADD CONSTRAINT "FacturaItemColor_facturaItemId_fkey" FOREIGN KEY ("facturaItemId") REFERENCES "FacturaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
