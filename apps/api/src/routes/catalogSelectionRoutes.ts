import { PrismaClient } from '@prisma/client';
import { RequestHandler, Router } from 'express';
import { ErrorCodes } from '@stockia/shared';
import { sendError } from '../middlewares/error.js';
import { catalogVersionStore } from '../lib/catalogVersion.js';

const OPERATIONS_CATALOG_TTL_MS = 300_000;

type OperationsCatalogResponse = {
    families: Array<{ id: string; label: string }>;
    suppliers: Array<{ id: string; label: string }>;
    colors: Array<{ id: string; label: string }>;
    curves: Array<{ id: string; label: string }>;
};

type OperationsCatalogCache = {
    data: OperationsCatalogResponse;
    expiresAt: number;
} | null;

let operationsCatalogCache: OperationsCatalogCache = null;

export const createCatalogSelectionRoutes = (
    prisma: PrismaClient,
    requireAuth: RequestHandler,
    readRateLimitMiddleware: RequestHandler
) => {
    const router = Router();

    router.get('/providers', readRateLimitMiddleware, requireAuth, async (_req, res) => {
        try {
            const providers = await prisma.supplier.findMany({
                orderBy: [{ name: 'asc' }],
                select: { id: true, code: true, name: true, logoUrl: true, createdAt: true, updatedAt: true }
            });

            return res.json(providers);
        } catch (error) {
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to load providers', error, _req.traceId);
        }
    });

    router.get('/size-tables', readRateLimitMiddleware, requireAuth, async (_req, res) => {
        try {
            const sizeTables = await prisma.sizeCurve.findMany({
                orderBy: [{ code: 'asc' }],
                include: { values: { orderBy: { sortOrder: 'asc' } } }
            });

            return res.json(sizeTables.map(table => ({
                ...table,
                sizes: table.values.map(value => value.value)
            })));
        } catch (error) {
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to load size tables', error, _req.traceId);
        }
    });

    router.get('/operations/catalogs', readRateLimitMiddleware, requireAuth, async (req, res) => {
        try {
            res.setHeader('ETag', catalogVersionStore.getOperationsCatalogVersion());
            const now = Date.now();
            if (operationsCatalogCache && operationsCatalogCache.expiresAt > now) {
                return res.json(operationsCatalogCache.data);
            }

            const [families, suppliers, sizeCurves] = await Promise.all([
                prisma.family.findMany({ orderBy: [{ description: 'asc' }], select: { id: true, description: true } }),
                prisma.supplier.findMany({ orderBy: [{ name: 'asc' }], select: { id: true, name: true } }),
                prisma.sizeCurve.findMany({
                    orderBy: [{ code: 'asc' }],
                    select: {
                        id: true,
                        code: true,
                        description: true,
                        values: { orderBy: { sortOrder: 'asc' }, select: { value: true } }
                    }
                })
            ]);

            const response: OperationsCatalogResponse = {
                families: families.map(entry => ({ id: entry.id, label: entry.description })),
                suppliers: suppliers.map(entry => ({ id: entry.id, label: entry.name })),
                colors: [],
                curves: sizeCurves.map(entry => {
                    const values = entry.values.map(value => value.value).join(',');
                    return {
                        id: entry.id,
                        label: values.length > 0 ? `${entry.code} - ${entry.description} (${values})` : `${entry.code} - ${entry.description}`
                    };
                })
            };

            operationsCatalogCache = {
                data: response,
                expiresAt: now + OPERATIONS_CATALOG_TTL_MS
            };

            return res.json(response);
        } catch (error) {
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to load operations catalogs', error, req.traceId);
        }
    });

    router.get('/operations/catalogs/version', readRateLimitMiddleware, requireAuth, async (_req, res) => {
        return res.json({ version: catalogVersionStore.getOperationsCatalogVersion() });
    });

    return router;
};
