import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient, Prisma } from '@prisma/client';
import {
    Factura,
    FacturaItem,
    VarianteColor,
    CreateFacturaDTO,
    UpdateFacturaDraftDTO,
    DuplicateHandler,
    FacturaEstado,
    CreateFacturaSchema,
    UpdateFacturaDraftSchema,
    FacturaFilters,
    FacturaListResponse,
    ErrorCodes
} from '@stockia/shared';
import { z } from 'zod';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

app.use(cors());
app.use(express.json());

const requireAdminToken = (req: Request, res: Response, next: () => void) => {
    if (!ADMIN_TOKEN) {
        return res.status(500).json({ error: 'Server misconfigured: missing ADMIN_TOKEN' });
    }

    const providedToken = req.header('x-admin-token');

    if (!providedToken) {
        return res.status(401).json({ error: 'Missing admin token' });
    }

    if (providedToken !== ADMIN_TOKEN) {
        return res.status(403).json({ error: 'Invalid admin token' });
    }

    next();
};

// --- Start Helper Functions ---

const mergeItems = (items: FacturaItem[], handler: DuplicateHandler = 'ERROR'): FacturaItem[] => {
    const itemMap = new Map<string, FacturaItem>();

    for (const item of items) {
        const itemKey = `${item.marca}|${item.tipoPrenda}|${item.codigoArticulo}`;

        if (!itemMap.has(itemKey)) {
            itemMap.set(itemKey, {
                ...item,
                colores: item.colores.map(c => ({
                    ...c,
                    cantidadesPorTalle: { ...c.cantidadesPorTalle } as Record<string, number>
                }))
            });
            continue;
        }

        const existingItem = itemMap.get(itemKey)!;
        const colorMap = new Map<string, VarianteColor>();

        for (const color of existingItem.colores) {
            colorMap.set(color.codigoColor, color);
        }

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

const validateFacturaIntegrity = (factura: any): string | null => {
    // At least one item
    if (!factura.items || factura.items.length === 0) {
        return 'Invoice must have at least one item';
    }

    for (const item of factura.items) {
        // Each item has at least one color
        if (!item.colores || item.colores.length === 0) {
            return `Item ${item.codigoArticulo} must have at least one color`;
        }

        for (const color of item.colores) {
            // Each color has at least one quantity > 0
            const quantities = color.cantidadesPorTalle as Record<string, number>;
            const hasPositive = Object.values(quantities).some(q => q > 0);
            if (!hasPositive) {
                return `Color ${color.codigoColor} in item ${item.codigoArticulo} must have at least one quantity > 0`;
            }

            // Size keys align with curvaTalles
            const sizes = Object.keys(quantities);
            for (const size of sizes) {
                if (!item.curvaTalles.includes(size)) {
                    return `Size ${size} not in curve for item ${item.codigoArticulo}`;
                }
            }
        }
    }

    return null; // Valid
};

// --- End Helper Functions ---

// GET /facturas (List with filters, pagination, sorting)
app.get('/facturas', async (req: Request, res: Response) => {
    try {
        const filters: FacturaFilters = {
            nroFactura: req.query.nroFactura as string,
            proveedor: req.query.proveedor as string,
            estado: req.query.estado as FacturaEstado,
            dateFrom: req.query.dateFrom as string,
            dateTo: req.query.dateTo as string,
            page: req.query.page ? parseInt(req.query.page as string) : 1,
            pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 50,
            sortBy: (req.query.sortBy as any) || 'fecha',
            sortDir: (req.query.sortDir as 'asc' | 'desc') || 'desc',
        };

        const where: Prisma.FacturaWhereInput = {};
        if (filters.nroFactura) where.nroFactura = { contains: filters.nroFactura, mode: 'insensitive' };
        if (filters.proveedor) where.proveedor = { contains: filters.proveedor, mode: 'insensitive' };
        if (filters.estado) where.estado = filters.estado;
        if (filters.dateFrom || filters.dateTo) {
            where.fecha = {};
            if (filters.dateFrom) where.fecha.gte = new Date(filters.dateFrom);
            if (filters.dateTo) where.fecha.lte = new Date(filters.dateTo);
        }

        const total = await prisma.factura.count({ where });
        const totalPages = Math.ceil(total / (filters.pageSize || 50));

        const facturas = await prisma.factura.findMany({
            where,
            orderBy: { [filters.sortBy || 'fecha']: filters.sortDir || 'desc' },
            skip: ((filters.page || 1) - 1) * (filters.pageSize || 50),
            take: filters.pageSize || 50,
            include: {
                items: {
                    include: {
                        colores: true
                    }
                }
            }
        });

        const response: FacturaListResponse = {
            items: facturas as any as Factura[],
            pagination: {
                page: filters.page || 1,
                pageSize: filters.pageSize || 50,
                total,
                totalPages
            }
        };

        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

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
app.post('/facturas', requireAdminToken, async (req: Request, res: Response) => {
    try {
        const validation = CreateFacturaSchema.safeParse(req.body);
        if (!validation.success) {
            const dup = validation.error.issues.find(i => i.message === ErrorCodes.DUPLICATE_ITEM_COLOR_IN_PAYLOAD);
            if (dup) {
                return res.status(400).json({ error: 'Duplicate Item/Color in payload', code: ErrorCodes.DUPLICATE_ITEM_COLOR_IN_PAYLOAD });
            }
            return res.status(400).json({
                error: 'Validation Failed',
                details: validation.error.format()
            });
        }

        const body: CreateFacturaDTO = validation.data;

        let processedItems: FacturaItem[] = [];
        if (body.items) {
            try {
                processedItems = mergeItems(body.items, 'ERROR');
            } catch (e: any) {
                return res.status(400).json({ error: e.message, code: ErrorCodes.DUPLICATE_ITEM_COLOR_IN_PAYLOAD });
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
                                cantidadesPorTalle: color.cantidadesPorTalle as any
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
app.patch('/facturas/:id/draft', requireAdminToken, async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const validation = UpdateFacturaDraftSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation Failed',
                details: validation.error.format()
            });
        }

        const body: UpdateFacturaDraftDTO = validation.data;
        const duplicateHandler = body.duplicateHandler || 'ERROR';

        let processedItems: FacturaItem[] = [];
        if (body.items) {
            try {
                processedItems = mergeItems(body.items, duplicateHandler);
            } catch (e: any) {
                return res.status(400).json({ error: e.message, code: ErrorCodes.DUPLICATE_ITEM_COLOR_IN_PAYLOAD });
            }
        }

        const updatedFactura = await prisma.$transaction(async (tx) => {
            const currentFactura = await tx.factura.findUnique({ where: { id } });
            if (!currentFactura) {
                throw new Error('NOT_FOUND');
            }

            // PHASE 3: Block editing FINAL invoices
            if (currentFactura.estado === FacturaEstado.FINAL) {
                throw new Error('INVOICE_FINAL_READ_ONLY');
            }

            if (body.expectedUpdatedAt) {
                const currentUpdated = new Date(currentFactura.updatedAt).toISOString();
                const expected = new Date(body.expectedUpdatedAt).toISOString();
                if (currentUpdated !== expected) {
                    throw new Error('OPTIMISTIC_LOCK_CONFLICT');
                }
            }

            await tx.factura.update({
                where: { id },
                data: {
                    proveedor: body.proveedor,
                }
            });

            if (body.items) {
                await tx.facturaItem.deleteMany({
                    where: { facturaId: id }
                });

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
        if (error.message === 'INVOICE_FINAL_READ_ONLY') return res.status(409).json({ error: 'Cannot edit finalized invoice', code: ErrorCodes.INVOICE_FINAL_READ_ONLY });
        if (error.message === 'OPTIMISTIC_LOCK_CONFLICT') return res.status(409).json({ error: 'Conflict: Data has changed since last retrieval' });

        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH /facturas/:id/finalize
app.patch('/facturas/:id/finalize', requireAdminToken, async (req: Request, res: Response) => {
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

        if (factura.estado === FacturaEstado.FINAL) {
            return res.status(400).json({ error: 'Invoice already finalized' });
        }

        // Validate integrity
        const integrityError = validateFacturaIntegrity(factura);
        if (integrityError) {
            return res.status(422).json({ error: integrityError, code: ErrorCodes.INVOICE_FINALIZE_INVALID });
        }

        // Finalize
        const finalized = await prisma.factura.update({
            where: { id },
            data: { estado: FacturaEstado.FINAL },
            include: {
                items: {
                    include: {
                        colores: true
                    }
                }
            }
        });

        res.json(finalized);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
