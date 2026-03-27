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

type QuickCurvePayload = {
    sizeCurveId?: string;
    code?: string;
    label?: string;
    values?: Record<string, number>;
};

const normalizeQuickCurveValues = (values: Record<string, number> | undefined) => {
    if (!values || typeof values !== 'object') {
        return null;
    }

    const entries = Object.entries(values)
        .map(([sizeKey, quantity]) => ({ sizeKey: sizeKey.trim(), quantity: Number(quantity) }))
        .filter((entry) => entry.sizeKey.length > 0);

    if (entries.length === 0) {
        return null;
    }

    if (entries.some((entry) => !Number.isFinite(entry.quantity) || entry.quantity < 0 || !Number.isInteger(entry.quantity))) {
        return null;
    }

    return entries;
};

const mapQuickCurveRecord = (record: {
    id: string;
    sizeCurveId: string;
    code: string;
    label: string;
    values: Array<{ sizeKey: string; quantity: number }>;
}) => ({
    id: record.id,
    sizeCurveId: record.sizeCurveId,
    code: record.code,
    label: record.label,
    values: Object.fromEntries(record.values.map((entry) => [entry.sizeKey, entry.quantity]))
});

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

    if (prismaError?.code === 'P2003') {
        return {
            status: 409,
            code: ErrorCodes.BAD_REQUEST,
            message: 'Cannot delete catalog item because it is referenced by other records'
        };
    }

    if (prismaError?.code === 'P2021' || prismaError?.code === 'P2022') {
        return {
            status: 503,
            code: ErrorCodes.INTERNAL_SERVER_ERROR,
            message: 'Quick curves catalog is not ready yet. Please run pending database migrations'
        };
    }

    return {
        status: 500,
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Unexpected error while processing catalog item'
    };
};

const mapQuickCurvesReadError = (error: unknown): { status: number; code: string; message: string } => {
    const prismaError = error as { code?: string };
    if (prismaError?.code === 'P2021' || prismaError?.code === 'P2022') {
        return {
            status: 503,
            code: ErrorCodes.INTERNAL_SERVER_ERROR,
            message: 'Quick curves catalog is not ready yet. Please run pending database migrations'
        };
    }

    return {
        status: 500,
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Failed to load quick curves'
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

    router.get('/admin/catalogs/quick-curves', readRateLimitMiddleware, requireAuth, async (req, res) => {
        const sizeCurveId = String(req.query.sizeCurveId ?? '').trim();
        if (!sizeCurveId) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'sizeCurveId is required', undefined, req.traceId);
        }

        try {
            const sizeCurve = await prisma.sizeCurve.findUnique({ where: { id: sizeCurveId }, select: { id: true } });
            if (!sizeCurve) {
                return sendError(res, 404, ErrorCodes.NOT_FOUND, 'Size curve not found', undefined, req.traceId);
            }

            const records = await prisma.quickCurve.findMany({
                where: { sizeCurveId },
                include: { values: { orderBy: { sortOrder: 'asc' } } },
                orderBy: { code: 'asc' }
            });
            return res.json(records.map(mapQuickCurveRecord));
        } catch (error) {
            logger.error({ err: error, traceId: req.traceId, operation: 'listQuickCurves', sizeCurveId }, 'Failed to load quick curves');
            const mapped = mapQuickCurvesReadError(error);
            return sendError(res, mapped.status, mapped.code, mapped.message, error, req.traceId);
        }
    });

    router.post('/admin/catalogs/quick-curves', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const payload = req.body as QuickCurvePayload;
        const sizeCurveId = payload.sizeCurveId?.trim();
        const code = payload.code?.trim();
        const label = payload.label?.trim();
        const normalizedValues = normalizeQuickCurveValues(payload.values);

        if (!sizeCurveId || !code || !label || !normalizedValues) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'sizeCurveId, code, label and valid values are required', undefined, req.traceId);
        }

        try {
            const sizeCurve = await prisma.sizeCurve.findUnique({
                where: { id: sizeCurveId },
                include: { values: { orderBy: { sortOrder: 'asc' } } }
            });
            if (!sizeCurve) {
                return sendError(res, 404, ErrorCodes.NOT_FOUND, 'Size curve not found', undefined, req.traceId);
            }

            const allowedSizes = new Set(sizeCurve.values.map((entry) => entry.value));
            const includesInvalidSize = normalizedValues.some((entry) => !allowedSizes.has(entry.sizeKey));
            if (includesInvalidSize) {
                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Quick curve values include unknown size keys', undefined, req.traceId);
            }

            const created = await prisma.quickCurve.create({
                data: {
                    sizeCurveId,
                    code,
                    label,
                    values: {
                        create: normalizedValues.map((entry, index) => ({
                            sizeKey: entry.sizeKey,
                            quantity: entry.quantity,
                            sortOrder: index
                        }))
                    }
                },
                include: { values: { orderBy: { sortOrder: 'asc' } } }
            });
            return res.status(201).json(mapQuickCurveRecord(created));
        } catch (error) {
            const mapped = mapCatalogWriteError(error);
            logger.error({ err: error, traceId: req.traceId, operation: 'createQuickCurve', payload }, 'Failed to create quick curve');
            return sendError(res, mapped.status, mapped.code, mapped.message, error, req.traceId);
        }
    });

    router.put('/admin/catalogs/quick-curves/:id', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const { id } = req.params;
        const payload = req.body as QuickCurvePayload;
        const sizeCurveId = payload.sizeCurveId?.trim();
        const code = payload.code?.trim();
        const label = payload.label?.trim();
        const normalizedValues = normalizeQuickCurveValues(payload.values);

        if (!sizeCurveId || !code || !label || !normalizedValues) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'sizeCurveId, code, label and valid values are required', undefined, req.traceId);
        }

        try {
            const sizeCurve = await prisma.sizeCurve.findUnique({
                where: { id: sizeCurveId },
                include: { values: { orderBy: { sortOrder: 'asc' } } }
            });
            if (!sizeCurve) {
                return sendError(res, 404, ErrorCodes.NOT_FOUND, 'Size curve not found', undefined, req.traceId);
            }

            const allowedSizes = new Set(sizeCurve.values.map((entry) => entry.value));
            const includesInvalidSize = normalizedValues.some((entry) => !allowedSizes.has(entry.sizeKey));
            if (includesInvalidSize) {
                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Quick curve values include unknown size keys', undefined, req.traceId);
            }

            const updated = await prisma.$transaction(async (tx) => {
                await tx.quickCurveValue.deleteMany({ where: { quickCurveId: id } });
                return tx.quickCurve.update({
                    where: { id },
                    data: {
                        sizeCurveId,
                        code,
                        label,
                        values: {
                            create: normalizedValues.map((entry, index) => ({
                                sizeKey: entry.sizeKey,
                                quantity: entry.quantity,
                                sortOrder: index
                            }))
                        }
                    },
                    include: { values: { orderBy: { sortOrder: 'asc' } } }
                });
            });

            return res.json(mapQuickCurveRecord(updated));
        } catch (error) {
            const mapped = mapCatalogWriteError(error);
            logger.error({ err: error, traceId: req.traceId, operation: 'updateQuickCurve', quickCurveId: id, payload }, 'Failed to update quick curve');
            return sendError(res, mapped.status, mapped.code, mapped.message, error, req.traceId);
        }
    });

    router.delete('/admin/catalogs/quick-curves/:id', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const { id } = req.params;
        try {
            await prisma.quickCurve.delete({ where: { id } });
            return res.status(204).send();
        } catch (error) {
            const mapped = mapCatalogWriteError(error);
            logger.error({ err: error, traceId: req.traceId, operation: 'deleteQuickCurve', quickCurveId: id }, 'Failed to delete quick curve');
            return sendError(res, mapped.status, mapped.code, mapped.message, error, req.traceId);
        }
    });

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
            const mapped = mapCatalogWriteError(error);
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
            return sendError(res, mapped.status, mapped.code, mapped.message, error, req.traceId);
        }
    });

    return router;
};
