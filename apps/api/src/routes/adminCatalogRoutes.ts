import { RequestHandler, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ErrorCodes } from '@stockia/shared';
import { sendError } from '../middlewares/error.js';
import { catalogVersionStore } from '../lib/catalogVersion.js';

const CATALOGS = ['suppliers', 'size-curves', 'families', 'categories', 'garment-types', 'materials', 'classifications'] as const;
type CatalogKey = (typeof CATALOGS)[number];

type CatalogField = 'name' | 'description' | 'logoUrl' | 'longDescription';

type CatalogConfig = {
    model: string;
    requiredFields: CatalogField[];
    optionalFields: CatalogField[];
};

const CATALOG_CONFIG: Record<CatalogKey, CatalogConfig> = {
    suppliers: { model: 'supplier', requiredFields: ['name'], optionalFields: ['logoUrl'] },
    'size-curves': { model: 'sizeCurve', requiredFields: ['description'], optionalFields: [] },
    families: { model: 'family', requiredFields: ['description'], optionalFields: [] },
    categories: { model: 'category', requiredFields: ['description'], optionalFields: ['logoUrl', 'longDescription'] },
    'garment-types': { model: 'garmentType', requiredFields: ['description'], optionalFields: [] },
    materials: { model: 'material', requiredFields: ['description'], optionalFields: [] },
    classifications: { model: 'classification', requiredFields: ['description'], optionalFields: [] }
};

type CatalogPayload = {
    code?: string;
    name?: string;
    description?: string;
    logoUrl?: string;
    longDescription?: string;
    values?: string[];
};

const isCatalogKey = (value: string): value is CatalogKey => (CATALOGS as readonly string[]).includes(value);
const impactsOperationsCatalogs = (catalog: CatalogKey) =>
    catalog === 'suppliers' || catalog === 'families' || catalog === 'size-curves';

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const getModelDelegate = (prisma: PrismaClient, model: string): Record<string, (...args: unknown[]) => Promise<unknown>> => {
    const delegate = (prisma as unknown as Record<string, unknown>)[model];
    if (!delegate || typeof delegate !== 'object') {
        throw new Error(`Prisma model delegate '${model}' not found`);
    }
    return delegate as Record<string, (...args: unknown[]) => Promise<unknown>>;
};

const normalizeSizeValues = (rawValues: unknown): string[] => {
    if (!Array.isArray(rawValues)) return [];
    return rawValues
        .filter(value => typeof value === 'string')
        .map(value => value.trim())
        .filter(Boolean);
};

const buildDataPayload = (catalog: CatalogKey, payload: CatalogPayload) => {
    const config = CATALOG_CONFIG[catalog];
    const data: Record<string, unknown> = { code: payload.code?.trim() };

    for (const field of [...config.requiredFields, ...config.optionalFields]) {
        const value = payload[field];
        if (typeof value === 'string') {
            data[field] = value.trim();
        }
    }

    return data;
};

const validatePayload = (catalog: CatalogKey, payload: CatalogPayload) => {
    if (!isNonEmptyString(payload.code)) {
        return 'Field code is required';
    }

    const config = CATALOG_CONFIG[catalog];
    for (const field of config.requiredFields) {
        if (!isNonEmptyString(payload[field])) {
            return `Field ${field} is required`;
        }
    }

    if (catalog === 'size-curves') {
        const values = normalizeSizeValues(payload.values);
        if (values.length === 0) {
            return 'Field values is required and must include at least one size value';
        }
    }

    return null;
};

export const createAdminCatalogRoutes = (
    prisma: PrismaClient,
    requireAuth: RequestHandler,
    readRateLimitMiddleware: RequestHandler,
    writeRateLimitMiddleware: RequestHandler
) => {
    const router = Router();

    router.get('/admin/catalogs/:catalog', readRateLimitMiddleware, requireAuth, async (req, res) => {
        const { catalog } = req.params;
        if (!isCatalogKey(catalog)) {
            return sendError(res, 400, ErrorCodes.BAD_REQUEST, `Unknown catalog '${catalog}'`, undefined, req.traceId);
        }

        try {
            res.setHeader('ETag', catalogVersionStore.getAdminCatalogVersion(catalog));
            const config = CATALOG_CONFIG[catalog];
            const model = getModelDelegate(prisma, config.model);

            if (catalog === 'size-curves') {
                const records = await model.findMany({
                    include: { values: { orderBy: { sortOrder: 'asc' } } },
                    orderBy: { code: 'asc' }
                });
                return res.json(records);
            }

            const records = await model.findMany({ orderBy: { code: 'asc' } });
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
        const validationError = validatePayload(catalog, payload);
        if (validationError) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, validationError, undefined, req.traceId);
        }

        try {
            const config = CATALOG_CONFIG[catalog];
            const model = getModelDelegate(prisma, config.model);
            const data = buildDataPayload(catalog, payload);

            if (catalog === 'size-curves') {
                const values = normalizeSizeValues(payload.values);
                const record = await model.create({
                    data: {
                        ...data,
                        values: {
                            create: values.map((value, index) => ({ value, sortOrder: index }))
                        }
                    },
                    include: { values: { orderBy: { sortOrder: 'asc' } } }
                });
                catalogVersionStore.bumpAdminCatalogVersion(catalog);
                if (impactsOperationsCatalogs(catalog)) {
                    catalogVersionStore.bumpOperationsCatalogVersion();
                }
                return res.status(201).json(record);
            }

            const record = await model.create({ data });
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
        const validationError = validatePayload(catalog, payload);
        if (validationError) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, validationError, undefined, req.traceId);
        }

        try {
            const config = CATALOG_CONFIG[catalog];
            const model = getModelDelegate(prisma, config.model);
            const data = buildDataPayload(catalog, payload);

            if (catalog === 'size-curves') {
                const values = normalizeSizeValues(payload.values);

                const record = await prisma.$transaction(async (tx) => {
                    await tx.sizeCurveValue.deleteMany({ where: { sizeCurveId: id } });
                    return tx.sizeCurve.update({
                        where: { id },
                        data: {
                            ...data,
                            values: {
                                create: values.map((value, index) => ({ value, sortOrder: index }))
                            }
                        },
                        include: { values: { orderBy: { sortOrder: 'asc' } } }
                    });
                });
                catalogVersionStore.bumpAdminCatalogVersion(catalog);
                if (impactsOperationsCatalogs(catalog)) {
                    catalogVersionStore.bumpOperationsCatalogVersion();
                }
                return res.json(record);
            }

            const record = await model.update({ where: { id }, data });
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
            const config = CATALOG_CONFIG[catalog];
            const model = getModelDelegate(prisma, config.model);

            await model.delete({ where: { id } });
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
