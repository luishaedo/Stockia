import { PrismaClient } from '@prisma/client';
import { CloneArticleSchema, CreateArticleSchema, ErrorCodes, ArticleSearchQuerySchema } from '@stockia/shared';
import { RequestHandler, Router } from 'express';
import { logger } from '../lib/logger.js';
import { sendError } from '../middlewares/error.js';

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

export const createArticleRoutes = (
    prisma: PrismaClient,
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

    router.post('/articles', writeRateLimitMiddleware, async (req, res) => {
        const validation = CreateArticleSchema.safeParse(req.body);
        if (!validation.success) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Validation Failed', validation.error.format(), req.traceId);
        }

        try {
            await validateCatalogReferences(prisma, validation.data);
            const created = await prisma.article.create({
                data: validation.data,
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
            logger.error({ err: error, traceId: req.traceId, operation: 'createArticle' }, 'Failed to create article');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to create article', error, req.traceId);
        }
    });

    router.post('/articles/:id/clone', writeRateLimitMiddleware, async (req, res) => {
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

    return router;
};
