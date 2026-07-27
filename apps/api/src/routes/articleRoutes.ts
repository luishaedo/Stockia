import { PrismaClient } from '@prisma/client';
import {
    ArticleSearchQuerySchema,
    CloneArticleSchema,
    CreateArticleSchema,
    CreateSupplierColorSchema,
    CreateSupplierSchema,
    ErrorCodes,
    UpdateArticleSchema,
    UpdateSupplierColorSchema
} from '@stockia/shared';
import { RequestHandler, Router } from 'express';
import { catalogVersionStore } from '../lib/catalogVersion.js';
import { logger } from '../lib/logger.js';
import { sendError } from '../middlewares/error.js';
import { MissingOptionalCatalogDefaultsError, resolveOptionalCatalogDefaults } from '../services/articleCatalogDefaults.js';
import { buildArticleExportCsv, buildArticleExportRows } from '../services/articleExportService.js';

const articleSelect = {
    id: true,
    sku: true,
    description: true,
    supplierId: true,
    familyId: true,
    materialId: true,
    categoryId: true,
    classificationId: true,
    garmentTypeId: true,
    sizeCurveId: true,
    baseArticleId: true,
    createdAt: true,
    updatedAt: true,
    supplier: { select: { id: true, code: true, name: true } },
    sizeCurve: {
        select: {
            id: true,
            code: true,
            description: true,
            values: { orderBy: { sortOrder: 'asc' as const }, select: { value: true } }
        }
    }
};

const toArticleResponse = (article: any) => ({
    id: article.id,
    sku: article.sku,
    description: article.description,
    supplierId: article.supplierId,
    familyId: article.familyId,
    materialId: article.materialId,
    categoryId: article.categoryId,
    classificationId: article.classificationId,
    garmentTypeId: article.garmentTypeId,
    sizeCurveId: article.sizeCurveId,
    baseArticleId: article.baseArticleId,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    supplier: {
        id: article.supplier.id,
        code: article.supplier.code,
        label: article.supplier.name
    },
    sizeCurve: {
        id: article.sizeCurve.id,
        code: article.sizeCurve.code,
        label: article.sizeCurve.description,
        values: article.sizeCurve.values.map((entry: { value: string }) => entry.value)
    }
});

const validateCatalogReferences = async (prisma: PrismaClient, payload: {
    supplierId: string;
    familyId: string;
    materialId: string;
    categoryId: string;
    classificationId: string;
    garmentTypeId: string;
    sizeCurveId: string;
}) => {
    const [supplier, family, material, category, classification, garmentType, sizeCurve] = await Promise.all([
        prisma.supplier.findUnique({ where: { id: payload.supplierId }, select: { id: true } }),
        prisma.family.findUnique({ where: { id: payload.familyId }, select: { id: true } }),
        prisma.material.findUnique({ where: { id: payload.materialId }, select: { id: true } }),
        prisma.category.findUnique({ where: { id: payload.categoryId }, select: { id: true } }),
        prisma.classification.findUnique({ where: { id: payload.classificationId }, select: { id: true } }),
        prisma.garmentType.findUnique({ where: { id: payload.garmentTypeId }, select: { id: true } }),
        prisma.sizeCurve.findUnique({ where: { id: payload.sizeCurveId }, select: { id: true } })
    ]);

    if (!supplier || !family || !material || !category || !classification || !garmentType || !sizeCurve) {
        throw new Error('INVALID_CATALOG_REFERENCE');
    }
};



const normalizeOptionalArticleCatalogIds = (payload: Record<string, unknown>) => {
    const normalized = { ...payload };
    for (const key of ['familyId', 'materialId', 'categoryId', 'classificationId', 'garmentTypeId'] as const) {
        if (typeof normalized[key] === 'string' && normalized[key].trim() === '') {
            delete normalized[key];
        }
    }
    return normalized;
};

export const createArticleRoutes = (
    prisma: PrismaClient,
    requireAuth: RequestHandler,
    readRateLimitMiddleware: RequestHandler,
    writeRateLimitMiddleware: RequestHandler
) => {
    const router = Router();

    router.get('/articles/search', readRateLimitMiddleware, async (req, res) => {
        const validation = ArticleSearchQuerySchema.safeParse(req.query);
        if (!validation.success) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Validation Failed', validation.error.format(), req.traceId);
        }

        try {
            const { supplierId, q, limit } = validation.data;
            const normalizedQuery = q?.trim();
            const whereClause = {
                supplierId,
                ...(normalizedQuery
                    ? {
                        OR: [
                            { sku: { contains: normalizedQuery, mode: 'insensitive' as const } },
                            { description: { contains: normalizedQuery, mode: 'insensitive' as const } }
                        ]
                    }
                    : {})
            };

            const articles = await prisma.article.findMany({
                where: whereClause,
                orderBy: [{ sku: 'asc' }],
                take: limit,
                select: articleSelect
            });

            return res.json({ items: articles.map(toArticleResponse) });
        } catch (error) {
            logger.error({ err: error, traceId: req.traceId, operation: 'searchArticles' }, 'Failed to search articles');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to search articles', error, req.traceId);
        }
    });

    router.get('/articles/export', readRateLimitMiddleware, requireAuth, async (req, res) => {
        const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId.trim() : '';
        if (!supplierId) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'supplierId is required', undefined, req.traceId);
        }

        try {
            const supplier = await prisma.supplier.findUnique({
                where: { id: supplierId },
                select: {
                    code: true,
                    colors: { select: { code: true, value: true } },
                    articles: {
                        orderBy: { sku: 'asc' },
                        select: {
                            sku: true,
                            description: true,
                            supplier: { select: { code: true } },
                            dragonfishEquivalences: { select: { colorCode: true } },
                            facturaItems: {
                                select: {
                                    colores: {
                                        select: {
                                            codigoColor: true,
                                            nombreColor: true,
                                            cantidadesPorTalle: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (!supplier) {
                return sendError(res, 404, ErrorCodes.NOT_FOUND, 'Supplier not found', undefined, req.traceId);
            }

            const rows = buildArticleExportRows(supplier.articles, supplier.colors);
            const safeSupplierCode = supplier.code.replace(/[^a-zA-Z0-9_-]/g, '_');
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="articulos-${safeSupplierCode}.csv"`);
            return res.send(`\uFEFF${buildArticleExportCsv(rows)}\n`);
        } catch (error) {
            logger.error({ err: error, traceId: req.traceId, operation: 'exportArticles' }, 'Failed to export articles');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to export articles', error, req.traceId);
        }
    });

    router.post('/suppliers', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const validation = CreateSupplierSchema.safeParse(req.body);
        if (!validation.success) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Validation Failed', validation.error.format(), req.traceId);
        }

        try {
            const created = await prisma.supplier.create({
                data: {
                    code: validation.data.code.trim(),
                    name: validation.data.name.trim(),
                    logoUrl: validation.data.logoUrl?.trim() || undefined,
                    logoPublicId: validation.data.logoPublicId?.trim() || undefined
                }
            });

            catalogVersionStore.bumpAdminCatalogVersion('suppliers');
            catalogVersionStore.bumpOperationsCatalogVersion();

            return res.status(201).json(created);
        } catch (error: any) {
            if (error?.code === 'P2002') {
                return sendError(res, 409, ErrorCodes.UNIQUE_CONSTRAINT_VIOLATION, 'Supplier code already exists', undefined, req.traceId);
            }
            logger.error({ err: error, traceId: req.traceId, operation: 'createSupplier' }, 'Failed to create supplier');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to create supplier', error, req.traceId);
        }
    });

    router.get('/suppliers/:supplierId/colors', readRateLimitMiddleware, async (req, res) => {
        const supplierId = req.params.supplierId?.trim();
        if (!supplierId) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'supplierId is required', undefined, req.traceId);
        }

        try {
            const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
            if (!supplier) {
                return sendError(res, 404, ErrorCodes.NOT_FOUND, 'Supplier not found', undefined, req.traceId);
            }

            const items = await prisma.supplierColor.findMany({
                where: { supplierId },
                orderBy: [{ code: 'asc' }]
            });

            return res.json({ items });
        } catch (error) {
            logger.error({ err: error, traceId: req.traceId, operation: 'listSupplierColors' }, 'Failed to list supplier colors');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to list supplier colors', error, req.traceId);
        }
    });

    router.post('/suppliers/:supplierId/colors', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const supplierId = req.params.supplierId?.trim();
        if (!supplierId) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'supplierId is required', undefined, req.traceId);
        }

        const validation = CreateSupplierColorSchema.safeParse(req.body);
        if (!validation.success) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Validation Failed', validation.error.format(), req.traceId);
        }

        const normalizedCode = validation.data.code.trim().toUpperCase();
        const normalizedValue = validation.data.value.trim();
        const isDefault = validation.data.isDefault ?? false;

        try {
            const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
            if (!supplier) {
                return sendError(res, 404, ErrorCodes.NOT_FOUND, 'Supplier not found', undefined, req.traceId);
            }

            const created = await prisma.$transaction(async (tx) => {
                if (isDefault) {
                    await tx.supplierColor.updateMany({
                        where: { supplierId, isDefault: true },
                        data: { isDefault: false }
                    });
                }

                return tx.supplierColor.create({
                    data: {
                        supplierId,
                        code: normalizedCode,
                        value: normalizedValue,
                        isDefault
                    }
                });
            });

            catalogVersionStore.bumpOperationsCatalogVersion();

            return res.status(201).json(created);
        } catch (error: any) {
            if (error?.code === 'P2002') {
                return sendError(
                    res,
                    409,
                    ErrorCodes.UNIQUE_CONSTRAINT_VIOLATION,
                    'Color code already exists for this supplier',
                    undefined,
                    req.traceId
                );
            }

            logger.error({ err: error, traceId: req.traceId, operation: 'createSupplierColor' }, 'Failed to create supplier color');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to create supplier color', error, req.traceId);
        }
    });

    router.patch('/suppliers/:supplierId/colors/:colorId', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const supplierId = req.params.supplierId?.trim();
        const colorId = req.params.colorId?.trim();
        if (!supplierId || !colorId) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'supplierId and colorId are required', undefined, req.traceId);
        }

        const validation = UpdateSupplierColorSchema.safeParse(req.body);
        if (!validation.success) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Validation Failed', validation.error.format(), req.traceId);
        }

        const dataToUpdate: { code?: string; value?: string; isDefault?: boolean } = {};
        if (validation.data.code !== undefined) {
            dataToUpdate.code = validation.data.code.trim().toUpperCase();
        }
        if (validation.data.value !== undefined) {
            dataToUpdate.value = validation.data.value.trim();
        }
        if (validation.data.isDefault !== undefined) {
            dataToUpdate.isDefault = validation.data.isDefault;
        }

        try {
            const existing = await prisma.supplierColor.findUnique({ where: { id: colorId }, select: { id: true, supplierId: true } });
            if (!existing || existing.supplierId !== supplierId) {
                return sendError(res, 404, ErrorCodes.NOT_FOUND, 'Supplier color not found', undefined, req.traceId);
            }

            const updated = await prisma.$transaction(async (tx) => {
                if (dataToUpdate.isDefault === true) {
                    await tx.supplierColor.updateMany({
                        where: { supplierId, isDefault: true, id: { not: colorId } },
                        data: { isDefault: false }
                    });
                }

                return tx.supplierColor.update({
                    where: { id: colorId },
                    data: dataToUpdate
                });
            });

            catalogVersionStore.bumpOperationsCatalogVersion();

            return res.json(updated);
        } catch (error: any) {
            if (error?.code === 'P2002') {
                return sendError(
                    res,
                    409,
                    ErrorCodes.UNIQUE_CONSTRAINT_VIOLATION,
                    'Color code already exists for this supplier',
                    undefined,
                    req.traceId
                );
            }

            logger.error({ err: error, traceId: req.traceId, operation: 'updateSupplierColor' }, 'Failed to update supplier color');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to update supplier color', error, req.traceId);
        }
    });

    router.delete('/suppliers/:supplierId/colors/:colorId', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const supplierId = req.params.supplierId?.trim();
        const colorId = req.params.colorId?.trim();
        if (!supplierId || !colorId) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'supplierId and colorId are required', undefined, req.traceId);
        }

        try {
            const existing = await prisma.supplierColor.findUnique({ where: { id: colorId }, select: { id: true, supplierId: true } });
            if (!existing || existing.supplierId !== supplierId) {
                return sendError(res, 404, ErrorCodes.NOT_FOUND, 'Supplier color not found', undefined, req.traceId);
            }

            await prisma.supplierColor.delete({ where: { id: colorId } });
            catalogVersionStore.bumpOperationsCatalogVersion();

            return res.status(204).send();
        } catch (error) {
            logger.error({ err: error, traceId: req.traceId, operation: 'deleteSupplierColor' }, 'Failed to delete supplier color');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete supplier color', error, req.traceId);
        }
    });

    router.post('/articles', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const normalizedBody = normalizeOptionalArticleCatalogIds(req.body as Record<string, unknown>);
        const validation = CreateArticleSchema.safeParse(normalizedBody);
        if (!validation.success) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Validation Failed', validation.error.format(), req.traceId);
        }

        try {
            const defaults = await resolveOptionalCatalogDefaults(prisma);
            const createPayload = {
                ...validation.data,
                familyId: validation.data.familyId ?? defaults.familyId,
                materialId: validation.data.materialId ?? defaults.materialId,
                categoryId: validation.data.categoryId ?? defaults.categoryId,
                classificationId: validation.data.classificationId ?? defaults.classificationId,
                garmentTypeId: validation.data.garmentTypeId ?? defaults.garmentTypeId
            };

            await validateCatalogReferences(prisma, createPayload);
            const created = await prisma.article.create({
                data: createPayload,
                select: articleSelect
            });

            return res.status(201).json(toArticleResponse(created));
        } catch (error: any) {
            if (error instanceof MissingOptionalCatalogDefaultsError) {
                return sendError(
                    res,
                    422,
                    ErrorCodes.VALIDATION_FAILED,
                    `Missing configured optional defaults (${error.missingCatalogs.join(', ')}). Create these catalog records to continue.`,
                    { configuredDefaults: ['family=06', 'material=99', 'category=99', 'classification=99', 'garmentType=99'] },
                    req.traceId
                );
            }
            if (error?.message === 'INVALID_CATALOG_REFERENCE') {
                return sendError(res, 422, ErrorCodes.VALIDATION_FAILED, 'Invalid catalog references', undefined, req.traceId);
            }
            if (error?.code === 'P2002') {
                return sendError(res, 409, ErrorCodes.UNIQUE_CONSTRAINT_VIOLATION, 'SKU already exists for supplier', undefined, req.traceId);
            }
            logger.error({ err: error, traceId: req.traceId, operation: 'createArticle' }, 'Failed to create article');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to create article', error, req.traceId);
        }
    });

    router.post('/articles/:id/clone', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const validation = CloneArticleSchema.safeParse(req.body);
        if (!validation.success) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Validation Failed', validation.error.format(), req.traceId);
        }

        try {
            const baseArticle = await prisma.article.findUnique({ where: { id: req.params.id } });
            if (!baseArticle) {
                return sendError(res, 404, ErrorCodes.NOT_FOUND, 'Article not found', undefined, req.traceId);
            }

            const clonePayload = {
                sku: validation.data.sku,
                description: validation.data.description,
                supplierId: validation.data.supplierId ?? baseArticle.supplierId,
                familyId: validation.data.familyId ?? baseArticle.familyId,
                materialId: validation.data.materialId ?? baseArticle.materialId,
                categoryId: validation.data.categoryId ?? baseArticle.categoryId,
                classificationId: validation.data.classificationId ?? baseArticle.classificationId,
                garmentTypeId: validation.data.garmentTypeId ?? baseArticle.garmentTypeId,
                sizeCurveId: validation.data.sizeCurveId ?? baseArticle.sizeCurveId
            };

            await validateCatalogReferences(prisma, clonePayload);

            const created = await prisma.article.create({
                data: {
                    ...clonePayload,
                    baseArticleId: baseArticle.id
                },
                select: articleSelect
            });

            return res.status(201).json(toArticleResponse(created));
        } catch (error: any) {
            if (error?.message === 'INVALID_CATALOG_REFERENCE') {
                return sendError(res, 422, ErrorCodes.VALIDATION_FAILED, 'Invalid catalog references', undefined, req.traceId);
            }
            if (error?.code === 'P2002') {
                return sendError(res, 409, ErrorCodes.UNIQUE_CONSTRAINT_VIOLATION, 'SKU already exists for supplier', undefined, req.traceId);
            }
            logger.error({ err: error, traceId: req.traceId, operation: 'cloneArticle' }, 'Failed to clone article');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to clone article', error, req.traceId);
        }
    });

    router.put('/articles/:id', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const validation = UpdateArticleSchema.safeParse(req.body);
        if (!validation.success) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Validation Failed', validation.error.format(), req.traceId);
        }

        try {
            await validateCatalogReferences(prisma, validation.data);
            const updated = await prisma.article.update({
                where: { id: req.params.id },
                data: validation.data,
                select: articleSelect
            });

            return res.json({ success: true, data: toArticleResponse(updated) });
        } catch (error: any) {
            if (error?.message === 'INVALID_CATALOG_REFERENCE') {
                return sendError(res, 422, ErrorCodes.VALIDATION_FAILED, 'Invalid catalog references', undefined, req.traceId);
            }
            if (error?.code === 'P2025') {
                return sendError(res, 404, ErrorCodes.NOT_FOUND, 'Article not found', undefined, req.traceId);
            }
            logger.error({ err: error, traceId: req.traceId, operation: 'updateArticle' }, 'Failed to update article');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to update article', error, req.traceId);
        }
    });

    router.delete('/articles/:id', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        try {
            await prisma.article.delete({
                where: { id: req.params.id }
            });

            return res.json({ success: true, data: { id: req.params.id } });
        } catch (error: any) {
            if (error?.code === 'P2025') {
                return sendError(res, 404, ErrorCodes.NOT_FOUND, 'Article not found', undefined, req.traceId);
            }
            if (error?.code === 'P2003') {
                return sendError(
                    res,
                    409,
                    ErrorCodes.VALIDATION_FAILED,
                    'Article cannot be deleted because it is linked to existing invoices',
                    undefined,
                    req.traceId
                );
            }
            logger.error({ err: error, traceId: req.traceId, operation: 'deleteArticle' }, 'Failed to delete article');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete article', error, req.traceId);
        }
    });

    return router;
};
