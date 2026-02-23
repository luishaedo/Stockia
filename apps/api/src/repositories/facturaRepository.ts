import { Prisma, PrismaClient } from '@prisma/client';
import { FacturaEstado, FacturaFilters, FacturaItem } from '@stockia/shared';
import { getItemKey } from '../utils/factura.js';

export class FacturaRepository {
    constructor(private readonly prisma: PrismaClient) {}

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

    findSupplierBySelection(selection: string) {
        return this.prisma.supplier.findFirst({
            where: {
                OR: [
                    { id: selection },
                    { code: { equals: selection, mode: 'insensitive' } },
                    { name: { equals: selection, mode: 'insensitive' } }
                ]
            }
        });
    }

    findAllSizeCurves() {
        return this.prisma.sizeCurve.findMany({ include: { values: { orderBy: { sortOrder: 'asc' } } } });
    }

    createDraft(data: { nroFactura: string; proveedor?: string; createdBy?: string; items: FacturaItem[] }) {
        return this.prisma.factura.create({
            data: {
                nroFactura: data.nroFactura,
                proveedor: data.proveedor,
                createdBy: data.createdBy,
                estado: FacturaEstado.DRAFT,
                items: {
                    create: data.items.map(item => ({
                        marca: item.marca,
                        tipoPrenda: item.tipoPrenda,
                        codigoArticulo: item.codigoArticulo,
                        curvaTalles: item.curvaTalles,
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
                        marca: nextItem.marca,
                        tipoPrenda: nextItem.tipoPrenda,
                        codigoArticulo: nextItem.codigoArticulo,
                        curvaTalles: nextItem.curvaTalles,
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

            await tx.facturaItem.update({ where: { id: existingItem.id }, data: { curvaTalles: nextItem.curvaTalles } });

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
            where.createdBy = { equals: filters.userId, mode: 'insensitive' };
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
                    createdBy: true
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
