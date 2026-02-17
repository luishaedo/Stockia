import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import {
    FacturaItem,
    VarianteColor,
    CreateFacturaDTO,
    UpdateFacturaDraftDTO,
    DuplicateHandler,
    FacturaEstado,
    CreateFacturaSchema,
    UpdateFacturaDraftSchema
} from '@stockia/shared';
import { z } from 'zod';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Start Helper Functions ---

const mergeItems = (items: FacturaItem[], handler: DuplicateHandler = 'ERROR'): FacturaItem[] => {
    const itemMap = new Map<string, FacturaItem>();

    for (const item of items) {
        // Unique key for item
        const itemKey = `${item.marca}|${item.tipoPrenda}|${item.codigoArticulo}`;

        if (!itemMap.has(itemKey)) {
            // Clone deep enough to avoid mutation refs
            itemMap.set(itemKey, {
                ...item,
                colores: item.colores.map(c => ({
                    ...c,
                    // Cast to Record<string, number> for internal logic
                    cantidadesPorTalle: { ...c.cantidadesPorTalle } as Record<string, number>
                }))
            });
            continue;
        }

        // Item exists, merge colors
        const existingItem = itemMap.get(itemKey)!;
        const colorMap = new Map<string, VarianteColor>();

        // Index existing colors
        for (const color of existingItem.colores) {
            colorMap.set(color.codigoColor, color);
        }

        // Merge new colors
        for (const newColor of item.colores) {
            if (colorMap.has(newColor.codigoColor)) {
                if (handler === 'ERROR') {
                    throw new Error(`DUPLICATE_ITEM_COLOR_IN_PAYLOAD`);
                }

                const existingColor = colorMap.get(newColor.codigoColor)!;
                const newQuantities = newColor.cantidadesPorTalle as Record<string, number>;
                const existingQuantities = existingColor.cantidadesPorTalle as Record<string, number>;

                if (handler === 'REPLACE') {
                    existingColor.cantidadesPorTalle = { ...newQuantities };
                } else if (handler === 'SUM') {
                    for (const [talle, cant] of Object.entries(newQuantities)) {
                        existingQuantities[talle] = (existingQuantities[talle] || 0) + cant;
                    }
                }
            } else {
                // Add new color
                const clonedColor = {
                    ...newColor,
                    cantidadesPorTalle: { ...newColor.cantidadesPorTalle } as Record<string, number>
                };
                colorMap.set(newColor.codigoColor, clonedColor);
                existingItem.colores.push(clonedColor);
            }
        }
    }

    return Array.from(itemMap.values());
};

// --- End Helper Functions ---

// GET /facturas/:id
app.get('/facturas/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const factura = await prisma.factura.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        colores: true
                    }
                }
            }
        });

        if (!factura) {
            return res.status(404).json({ error: 'Factura not found' });
        }

        res.json(factura);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /facturas
app.post('/facturas', async (req: Request, res: Response) => {
    try {
        // 1. Validation
        const validation = CreateFacturaSchema.safeParse(req.body);
        if (!validation.success) {
            const dup = validation.error.issues.find(i => i.message === 'DUPLICATE_ITEM_COLOR_IN_PAYLOAD');
            if (dup) {
                return res.status(400).json({ error: 'Duplicate Item/Color in payload', code: 'DUPLICATE_ITEM_COLOR_IN_PAYLOAD' });
            }
            return res.status(400).json({
                error: 'Validation Failed',
                details: validation.error.format()
            });
        }

        const body: CreateFacturaDTO = validation.data;

        // 2. Logic (Duplicate Check implicit in Zod or strict ERROR default)
        let processedItems: FacturaItem[] = [];
        if (body.items) {
            try {
                // Post always uses strict 'ERROR' for duplicates in payload
                processedItems = mergeItems(body.items, 'ERROR');
            } catch (e: any) {
                return res.status(400).json({ error: e.message, code: 'DUPLICATE_ITEM_COLOR_IN_PAYLOAD' });
            }
        }

        // 3. Persistence
        const newFactura = await prisma.factura.create({
            data: {
                nroFactura: body.nroFactura,
                proveedor: body.proveedor,
                estado: FacturaEstado.DRAFT,
                items: {
                    create: processedItems.map(item => ({
                        marca: item.marca,
                        tipoPrenda: item.tipoPrenda,
                        codigoArticulo: item.codigoArticulo,
                        curvaTalles: item.curvaTalles,
                        colores: {
                            create: item.colores.map(color => ({
                                codigoColor: color.codigoColor,
                                nombreColor: color.nombreColor,
                                cantidadesPorTalle: color.cantidadesPorTalle as any // JSON
                            }))
                        }
                    }))
                }
            },
            include: {
                items: {
                    include: {
                        colores: true
                    }
                }
            }
        });

        res.status(201).json(newFactura);
    } catch (error: any) {
        console.error(error);
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Unique Constraint Violation' });
        }
        res.status(500).json({ error: error.message });
    }
});

// PATCH /facturas/:id/draft
app.patch('/facturas/:id/draft', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        // 1. Validation
        const validation = UpdateFacturaDraftSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation Failed',
                details: validation.error.format()
            });
        }

        const body: UpdateFacturaDraftDTO = validation.data;
        const duplicateHandler = body.duplicateHandler || 'ERROR';

        // 2. Merge Logic
        let processedItems: FacturaItem[] = [];
        if (body.items) {
            try {
                processedItems = mergeItems(body.items, duplicateHandler);
            } catch (e: any) {
                return res.status(400).json({ error: e.message, code: 'DUPLICATE_ITEM_COLOR_IN_PAYLOAD' });
            }
        }

        // 3. Transaction with Optimistic Locking
        const updatedFactura = await prisma.$transaction(async (tx) => {
            // a. Check existence and updatedAt
            const currentFactura = await tx.factura.findUnique({ where: { id } });
            if (!currentFactura) {
                throw new Error('NOT_FOUND');
            }

            if (body.expectedUpdatedAt) {
                const currentUpdated = new Date(currentFactura.updatedAt).toISOString();
                const expected = new Date(body.expectedUpdatedAt).toISOString();
                if (currentUpdated !== expected) {
                    throw new Error('OPTIMISTIC_LOCK_CONFLICT');
                }
            }

            // b. Update Header
            await tx.factura.update({
                where: { id },
                data: {
                    proveedor: body.proveedor,
                    // updatedAt updated automatically by Prisma
                }
            });

            if (body.items) {
                // c. Delete existing items
                await tx.facturaItem.deleteMany({
                    where: { facturaId: id }
                });

                // d. Re-create items
                await tx.factura.update({
                    where: { id },
                    data: {
                        items: {
                            create: processedItems.map(item => ({
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
                    }
                });
            }

            return tx.factura.findUnique({
                where: { id },
                include: { items: { include: { colores: true } } }
            });
        });

        res.json(updatedFactura);

    } catch (error: any) {
        if (error.message === 'NOT_FOUND') return res.status(404).json({ error: 'Factura not found' });
        if (error.message === 'OPTIMISTIC_LOCK_CONFLICT') return res.status(409).json({ error: 'Conflict: Data has changed since last retrieval' });

        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
