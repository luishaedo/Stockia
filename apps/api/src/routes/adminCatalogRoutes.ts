import { RequestHandler, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ErrorCodes } from '@stockia/shared';
import { sendError } from '../middlewares/error.js';
import { catalogVersionStore } from '../lib/catalogVersion.js';
import {
    CatalogPayload,
    buildCatalogDataPayload,
    createAdminCatalogHandlers,
    impactsOperationsCatalogs,
    isCatalogKey,
    validateCatalogPayload
} from '../services/adminCatalogHandlers.js';

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
            const record = await handlers[catalog].create({ ...data, values: payload.values });
            catalogVersionStore.bumpAdminCatalogVersion(catalog);
            if (impactsOperationsCatalogs(catalog)) {
                catalogVersionStore.bumpOperationsCatalogVersion();
            }
            return res.status(201).json(record);
        } catch (error) {
            return sendError(res, 400, ErrorCodes.UNIQUE_CONSTRAINT_VIOLATION, 'Could not create catalog item', error, req.traceId);
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
            const record = await handlers[catalog].update(id, { ...data, values: payload.values });
            catalogVersionStore.bumpAdminCatalogVersion(catalog);
            if (impactsOperationsCatalogs(catalog)) {
                catalogVersionStore.bumpOperationsCatalogVersion();
            }
            return res.json(record);
        } catch (error) {
            return sendError(res, 400, ErrorCodes.BAD_REQUEST, 'Could not update catalog item', error, req.traceId);
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
            return sendError(res, 400, ErrorCodes.BAD_REQUEST, 'Could not delete catalog item', error, req.traceId);
        }
    });

    return router;
};
