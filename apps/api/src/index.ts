import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import {
    FacturaItem,
    VarianteColor,
    CreateFacturaDTO,
    UpdateFacturaDraftDTO,
    DuplicateHandler,
    FacturaEstado
} from '@stockia/shared';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Helper to merge items based on duplicate handler
const mergeItems = (items: FacturaItem[], handler: DuplicateHandler = 'ERROR'): FacturaItem[] => {
    const itemMap = new Map<string, FacturaItem>();

    for (const item of items) {
        const itemKey = `${item.marca}-${item.tipoPrenda}-${item.codigoArticulo}`;

        if (!itemMap.has(itemKey)) {
            // Clone deep enough
            itemMap.set(itemKey, {
                ...item,
                colores: item.colores.map(c => ({
                    ...c,
                    cantidadesPorTalle: { ...c.cantidadesPorTalle }
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
                    throw new Error(`Duplicate color ${newColor.codigoColor} for item ${itemKey}`);
                }

                const existingColor = colorMap.get(newColor.codigoColor)!;

                if (handler === 'REPLACE') {
                    existingColor.cantidadesPorTalle = { ...newColor.cantidadesPorTalle };
                } else if (handler === 'SUM') {
                    for (const [talle, cant] of Object.entries(newColor.cantidadesPorTalle)) {
                        existingColor.cantidadesPorTalle[talle] =
                            (existingColor.cantidadesPorTalle[talle] || 0) + cant;
                    }
                }
            } else {
                // Add new color
                const clonedColor = {
                    ...newColor,
                    cantidadesPorTalle: { ...newColor.cantidadesPorTalle }
                };
                colorMap.set(newColor.codigoColor, clonedColor);
                existingItem.colores.push(clonedColor);
            }
        }
    }

    return Array.from(itemMap.values());
};

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
    const body: CreateFacturaDTO = req.body;

    try {
        if (!body.nroFactura) {
            return res.status(400).json({ error: 'nroFactura is required' });
        }

        let processedItems: FacturaItem[] = [];
        if (body.items) {
            // Create assumes strict validation usually, but we accept clean data
            try {
                processedItems = mergeItems(body.items, 'ERROR');
            } catch (e: any) {
                return res.status(400).json({ error: e.message });
            }
        }

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
                                cantidadesPorTalle: color.cantidadesPorTalle
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
        res.status(400).json({ error: error.message });
    }
});

// PATCH /facturas/:id/draft
app.patch('/facturas/:id/draft', async (req: Request, res: Response) => {
    const { id } = req.params;
    const body: UpdateFacturaDraftDTO = req.body;
    const duplicateHandler = body.duplicateHandler || 'ERROR';

    try {
        let processedItems: FacturaItem[] = [];
        if (body.items) {
            try {
                processedItems = mergeItems(body.items, duplicateHandler);
            } catch (e: any) {
                return res.status(400).json({ error: e.message });
            }
        }

        const updatedFactura = await prisma.$transaction(async (tx) => {
            // 1. Update Factura fields
            await tx.factura.update({
                where: { id },
                data: {
                    proveedor: body.proveedor,
                    // updatedAt updated automatically
                }
            });

            if (body.items) {
                // 2. Delete existing items
                await tx.facturaItem.deleteMany({
                    where: { facturaId: id }
                });

                // 3. Create new items
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
                                        cantidadesPorTalle: color.cantidadesPorTalle
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
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
