import { PrismaClient } from '@prisma/client';
import { RequestHandler, Router } from 'express';
import { ErrorCodes } from '@stockia/shared';
import { sendError } from '../middlewares/error.js';

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

    return router;
};
