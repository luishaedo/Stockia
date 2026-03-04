import { RequestHandler, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ErrorCodes } from '@stockia/shared';
import { sendError } from '../middlewares/error.js';
import { catalogVersionStore } from '../lib/catalogVersion.js';
import { logger } from '../lib/logger.js';
import {
    CatalogPayload,
    buildCatalogDataPayload,
    createAdminCatalogHandlers,
    impactsOperationsCatalogs,
    isCatalogKey,
    validateCatalogPayload
} from '../services/adminCatalogHandlers.js';

const mapCatalogWriteError = (error: unknown): { status: number; code: string; message: string } => {
    const prismaError = error as { code?: string };

    if (prismaError?.code === 'P2002') {
        return {
            status: 409,
            code: ErrorCodes.UNIQUE_CONSTRAINT_VIOLATION,
            message: 'A catalog item with this code already exists'
        };
    }

    if (prismaError?.code === 'P2025') {
        return {
            status: 404,
            code: ErrorCodes.NOT_FOUND,
            message: 'Catalog item not found'
        };
    }

    if (prismaError?.code === 'P2009' || prismaError?.code === 'P2012') {
        return {
            status: 400,
            code: ErrorCodes.VALIDATION_FAILED,
            message: 'Invalid catalog payload'
        };
    }

    return {
        status: 500,
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Unexpected error while processing catalog item'
    };
};

export const createAdminCatalogRoutes = (
    prisma: PrismaClient,
    requireAuth: RequestHandler,
    readRateLimitMiddleware: RequestHandler,
    writeRateLimitMiddleware: RequestHandler
) => {
    const router = Router();
    const handlers = createAdminCatalogHandlers(prisma);

    router.get('/admin/catalogs/:catalog', readRateLimitMiddleware, requireAuth, async (req, res) => {
        const { catalog } = req.params;
        if (!isCatalogKey(catalog)) {
            return sendError(res, 400, ErrorCodes.BAD_REQUEST, `Unknown catalog '${catalog}'`, undefined, req.traceId);
        }

        try {
            res.setHeader('ETag', catalogVersionStore.getAdminCatalogVersion(catalog));
            const records = await handlers[catalog].list();
            return res.json(records);
        } catch (error) {
            logger.error(
                { err: error, traceId: req.traceId, catalog, operation: 'listAdminCatalog' },
                'Failed to load admin catalog data'
            );
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to load catalog data', error, req.traceId);
        }
    });

    router.get('/admin/catalogs/:catalog/version', readRateLimitMiddleware, requireAuth, async (req, res) => {
        const { catalog } = req.params;
        if (!isCatalogKey(catalog)) {
            return sendError(res, 400, ErrorCodes.BAD_REQUEST, `Unknown catalog '${catalog}'`, undefined, req.traceId);
        }

        return res.json({ version: catalogVersionStore.getAdminCatalogVersion(catalog) });
    });

    router.post('/admin/catalogs/:catalog', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const { catalog } = req.params;
        if (!isCatalogKey(catalog)) {
            return sendError(res, 400, ErrorCodes.BAD_REQUEST, `Unknown catalog '${catalog}'`, undefined, req.traceId);
        }

        const payload = req.body as CatalogPayload;
        const validationError = validateCatalogPayload(catalog, payload);
        if (validationError) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, validationError, undefined, req.traceId);
        }

        try {
            const data = buildCatalogDataPayload(catalog, payload);
            const valuesData = catalog === 'size-curves' ? { values: payload.values } : {};
            const record = await handlers[catalog].create({ ...data, ...valuesData });
            catalogVersionStore.bumpAdminCatalogVersion(catalog);
            if (impactsOperationsCatalogs(catalog)) {
                catalogVersionStore.bumpOperationsCatalogVersion();
            }
            return res.status(201).json(record);
        } catch (error) {
            const mapped = mapCatalogWriteError(error);
            logger.error(
                {
                    err: error,
                    traceId: req.traceId,
                    catalog,
                    operation: 'createAdminCatalogItem',
                    payload
                },
                'Failed to create admin catalog item'
            );
            return sendError(res, mapped.status, mapped.code, mapped.message, error, req.traceId);
        }
    });

    router.put('/admin/catalogs/:catalog/:id', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const { catalog, id } = req.params;
        if (!isCatalogKey(catalog)) {
            return sendError(res, 400, ErrorCodes.BAD_REQUEST, `Unknown catalog '${catalog}'`, undefined, req.traceId);
        }

        const payload = req.body as CatalogPayload;
        const validationError = validateCatalogPayload(catalog, payload);
        if (validationError) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, validationError, undefined, req.traceId);
        }

        try {
            const data = buildCatalogDataPayload(catalog, payload);
            const valuesData = catalog === 'size-curves' ? { values: payload.values } : {};
            const record = await handlers[catalog].update(id, { ...data, ...valuesData });
            catalogVersionStore.bumpAdminCatalogVersion(catalog);
            if (impactsOperationsCatalogs(catalog)) {
                catalogVersionStore.bumpOperationsCatalogVersion();
            }
            return res.json(record);
        } catch (error) {
            const mapped = mapCatalogWriteError(error);
            logger.error(
                {
                    err: error,
                    traceId: req.traceId,
                    catalog,
                    catalogItemId: id,
                    operation: 'updateAdminCatalogItem',
                    payload
                },
                'Failed to update admin catalog item'
            );
            return sendError(res, mapped.status, mapped.code, mapped.message, error, req.traceId);
        }
    });

    router.delete('/admin/catalogs/:catalog/:id', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const { catalog, id } = req.params;
        if (!isCatalogKey(catalog)) {
            return sendError(res, 400, ErrorCodes.BAD_REQUEST, `Unknown catalog '${catalog}'`, undefined, req.traceId);
        }

        try {
            await handlers[catalog].remove(id);
            catalogVersionStore.bumpAdminCatalogVersion(catalog);
            if (impactsOperationsCatalogs(catalog)) {
                catalogVersionStore.bumpOperationsCatalogVersion();
            }
            return res.status(204).send();
        } catch (error) {
            logger.error(
                {
                    err: error,
                    traceId: req.traceId,
                    catalog,
                    catalogItemId: id,
                    operation: 'deleteAdminCatalogItem'
                },
                'Failed to delete admin catalog item'
            );
            return sendError(res, 400, ErrorCodes.BAD_REQUEST, 'Could not delete catalog item', error, req.traceId);
        }
    });

    return router;
};
