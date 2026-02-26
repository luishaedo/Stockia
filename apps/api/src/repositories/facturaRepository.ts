import { Prisma, PrismaClient } from '@prisma/client';
import { FacturaEstado, FacturaFilters, FacturaItem } from '@stockia/shared';
import { getItemKey } from '../utils/factura.js';

export class FacturaRepository {
    constructor(private readonly prisma: PrismaClient) {}

    private getSupplierLabel(item: Pick<FacturaItem, 'supplierLabel' | 'marca'>): string {
        return item.supplierLabel?.trim() || item.marca?.trim() || '';
    }

    async list(filters: FacturaFilters) {
        const where: Prisma.FacturaWhereInput = {};
        if (filters.nroFactura) where.nroFactura = { contains: filters.nroFactura, mode: 'insensitive' };
        if (filters.proveedor) where.proveedor = { contains: filters.proveedor, mode: 'insensitive' };
        if (filters.estado) where.estado = filters.estado;
        if (filters.dateFrom || filters.dateTo) {
            where.fecha = {};
            if (filters.dateFrom) where.fecha.gte = new Date(filters.dateFrom);
            if (filters.dateTo) where.fecha.lte = new Date(filters.dateTo);
        }

        const total = await this.prisma.factura.count({ where });
        const facturas = await this.prisma.factura.findMany({
            where,
            orderBy: { [filters.sortBy || 'fecha']: filters.sortDir || 'desc' },
            skip: ((filters.page || 1) - 1) * (filters.pageSize || 50),
            take: filters.pageSize || 50,
            include: { items: { include: { colores: true } } }
        });

        return { total, facturas };
    }

    findById(id: string) {
        return this.prisma.factura.findUnique({
            where: { id },
            include: { items: { include: { colores: true } } }
        });
    }

    findSupplierById(id: string) {
        return this.prisma.supplier.findUnique({ where: { id } });
    }

    upsertInvoiceUserByExternalId(externalId: string) {
        const normalizedExternalId = externalId.trim();
        return this.prisma.invoiceUser.upsert({
            where: { externalId: normalizedExternalId },
            update: { name: normalizedExternalId },
            create: {
                externalId: normalizedExternalId,
                name: normalizedExternalId
            }
        });
    }

    findAllSizeCurves() {
        return this.prisma.sizeCurve.findMany({ include: { values: { orderBy: { sortOrder: 'asc' } } } });
    }

    findSizeCurveById(id: string) {
        return this.prisma.sizeCurve.findUnique({
            where: { id },
            include: { values: { orderBy: { sortOrder: 'asc' } } }
        });
    }

    createDraft(data: {
        nroFactura: string;
        proveedor?: string;
        supplierSnapshot?: { id: string; code: string; label: string };
        createdBy?: string;
        createdByUserId?: string;
        items: FacturaItem[]
    }) {
        return this.prisma.factura.create({
            data: {
                nroFactura: data.nroFactura,
                proveedor: data.proveedor,
                createdBy: data.createdBy,
                createdByUserId: data.createdByUserId,
                supplierSnapshot: data.supplierSnapshot as Prisma.InputJsonValue | undefined,
                estado: FacturaEstado.DRAFT,
                items: {
                    create: data.items.map(item => ({
                        marca: this.getSupplierLabel(item),
                        tipoPrenda: item.tipoPrenda,
                        codigoArticulo: item.codigoArticulo,
                        curvaTalles: item.curvaTalles,
                        garmentTypeSnapshot: item.garmentTypeSnapshot as Prisma.InputJsonValue | undefined,
                        sizeCurveSnapshot: item.sizeCurveSnapshot as Prisma.InputJsonValue | undefined,
                        colores: {
                            create: item.colores.map(color => ({
                                codigoColor: color.codigoColor,
                                nombreColor: color.nombreColor,
                                cantidadesPorTalle: color.cantidadesPorTalle as any
                            }))
                        }
                    }))
                }
            },
            include: { items: { include: { colores: true } } }
        });
    }

    async runDraftTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
        return this.prisma.$transaction(async tx => callback(tx));
    }

    async syncDraftItems(tx: Prisma.TransactionClient, facturaId: string, nextItems: FacturaItem[]) {
        const existingItems = await tx.facturaItem.findMany({ where: { facturaId }, include: { colores: true } });
        const existingByKey = new Map(existingItems.map(item => [getItemKey(item), item]));
        const preservedItemIds = new Set<string>();

        for (const nextItem of nextItems) {
            const key = getItemKey(nextItem);
            const existingItem = existingByKey.get(key);

            if (!existingItem) {
                await tx.facturaItem.create({
                    data: {
                        facturaId,
                        marca: this.getSupplierLabel(nextItem),
                        tipoPrenda: nextItem.tipoPrenda,
                        codigoArticulo: nextItem.codigoArticulo,
                        curvaTalles: nextItem.curvaTalles,
                        garmentTypeSnapshot: nextItem.garmentTypeSnapshot as Prisma.InputJsonValue | undefined,
                        sizeCurveSnapshot: nextItem.sizeCurveSnapshot as Prisma.InputJsonValue | undefined,
                        colores: {
                            create: nextItem.colores.map(color => ({
                                codigoColor: color.codigoColor,
                                nombreColor: color.nombreColor,
                                cantidadesPorTalle: color.cantidadesPorTalle as any
                            }))
                        }
                    }
                });
                continue;
            }

            preservedItemIds.add(existingItem.id);

            await tx.facturaItem.update({
                where: { id: existingItem.id },
                data: {
                    curvaTalles: nextItem.curvaTalles,
                    garmentTypeSnapshot: nextItem.garmentTypeSnapshot as Prisma.InputJsonValue | undefined,
                    sizeCurveSnapshot: nextItem.sizeCurveSnapshot as Prisma.InputJsonValue | undefined
                }
            });

            const existingColorByCode = new Map(existingItem.colores.map(color => [color.codigoColor, color]));
            const preservedColorIds = new Set<string>();

            for (const nextColor of nextItem.colores) {
                const existingColor = existingColorByCode.get(nextColor.codigoColor);
                if (!existingColor) {
                    await tx.facturaItemColor.create({
                        data: {
                            facturaItemId: existingItem.id,
                            codigoColor: nextColor.codigoColor,
                            nombreColor: nextColor.nombreColor,
                            cantidadesPorTalle: nextColor.cantidadesPorTalle as any
                        }
                    });
                    continue;
                }

                preservedColorIds.add(existingColor.id);
                await tx.facturaItemColor.update({
                    where: { id: existingColor.id },
                    data: {
                        nombreColor: nextColor.nombreColor,
                        cantidadesPorTalle: nextColor.cantidadesPorTalle as any
                    }
                });
            }

            await tx.facturaItemColor.deleteMany({
                where: { facturaItemId: existingItem.id, id: { notIn: Array.from(preservedColorIds) } }
            });
        }

        await tx.facturaItem.deleteMany({
            where: { facturaId, id: { notIn: Array.from(preservedItemIds) } }
        });
    }

    listAdminInvoices(filters: { page: number; pageSize: number; from?: string; to?: string; userId?: string }) {
        const where: Prisma.FacturaWhereInput = {};

        if (filters.from || filters.to) {
            where.createdAt = {};
            if (filters.from) where.createdAt.gte = new Date(filters.from);
            if (filters.to) where.createdAt.lte = new Date(filters.to);
        }

        if (filters.userId) {
            where.createdByUserId = filters.userId;
        }

        return Promise.all([
            this.prisma.factura.count({ where }),
            this.prisma.factura.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (filters.page - 1) * filters.pageSize,
                take: filters.pageSize,
                select: {
                    id: true,
                    nroFactura: true,
                    proveedor: true,
                    estado: true,
                    createdAt: true,
                    createdBy: true,
                    createdByUser: {
                        select: {
                            id: true,
                            externalId: true,
                            name: true,
                            email: true
                        }
                    }
                }
            })
        ]);
    }

    listAdminInvoiceUsers(filters: { page: number; pageSize: number; search?: string }) {
        const where: Prisma.InvoiceUserWhereInput = {};

        if (filters.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { externalId: { contains: filters.search, mode: 'insensitive' } },
                { email: { contains: filters.search, mode: 'insensitive' } }
            ];
        }

        return Promise.all([
            this.prisma.invoiceUser.count({ where }),
            this.prisma.invoiceUser.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (filters.page - 1) * filters.pageSize,
                take: filters.pageSize,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    externalId: true
                }
            })
        ]);
    }

    async updateToFinal(id: string, expectedUpdatedAt: string) {
        const result = await this.prisma.factura.updateMany({
            where: {
                id,
                estado: FacturaEstado.DRAFT,
                updatedAt: new Date(expectedUpdatedAt)
            },
            data: { estado: FacturaEstado.FINAL }
        });

        if (result.count === 0) {
            return null;
        }

        return this.prisma.factura.findUnique({
            where: { id },
            include: { items: { include: { colores: true } } }
        });
    }
}
