import { RequestHandler, Router } from 'express';
import { ErrorCodes } from '@stockia/shared';
import { logger } from '../lib/logger.js';
import { sendError } from '../middlewares/error.js';
import { MultipartValidationError, runSingleFileUpload } from '../middlewares/upload.js';
import { ArticleImportService } from '../services/articleImportService.js';
import { MissingOptionalCatalogDefaultsError } from '../services/articleCatalogDefaults.js';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.csv', '.xls', '.xlsx']);

export const createArticleImportRoutes = (
    service: ArticleImportService,
    requireAuth: RequestHandler,
    writeRateLimitMiddleware: RequestHandler
) => {
    const router = Router();

    router.get('/admin/articles/import/template', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        try {
            const templateWorkbook = service.buildImportTemplateWorkbook();
            const filename = `article-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.status(200).send(templateWorkbook);
        } catch (error) {
            logger.error({ err: error, traceId: req.traceId, operation: 'downloadArticleImportTemplate' }, 'Failed to generate article import template');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'No se pudo generar el template de importación', error, req.traceId);
        }
    });


    router.get('/admin/articles/import/readiness', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        try {
            const readiness = await service.getImportReadiness();
            return res.json(readiness);
        } catch (error) {
            logger.error({ err: error, traceId: req.traceId, operation: 'getArticleImportReadiness' }, 'Failed to evaluate article import readiness');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'No se pudo evaluar readiness de importación', error, req.traceId);
        }
    });

    router.post('/admin/articles/import/preview', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        try {
            const uploadedFile = await runSingleFileUpload(req, {
                fieldName: 'file',
                maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
                allowedExtensions: ALLOWED_EXTENSIONS
            });

            const preview = await service.buildPreview(uploadedFile.buffer, uploadedFile.originalname);
            return res.json(preview);
        } catch (error) {
            if (error instanceof MultipartValidationError) {
                if (error.code === 'INVALID_CONTENT_TYPE') {
                    return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Content-Type debe ser multipart/form-data', undefined, req.traceId);
                }

                if (error.code === 'FILE_REQUIRED') {
                    return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'El campo file es obligatorio', undefined, req.traceId);
                }

                if (error.code === 'FILE_TOO_LARGE') {
                    return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'El archivo de importación supera el límite de 10MB', undefined, req.traceId);
                }

                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'La extensión del archivo debe ser .csv, .xls o .xlsx', undefined, req.traceId);
            }

            if (error instanceof MissingOptionalCatalogDefaultsError) {
                return sendError(
                    res,
                    422,
                    ErrorCodes.VALIDATION_FAILED,
                    `Faltan catálogos default configurados (${error.missingCatalogs.join(', ')}). Crear registros base para continuar.`,
                    { configuredDefaults: ['family=06', 'material=99', 'category=99', 'classification=99', 'garmentType=99'] },
                    req.traceId
                );
            }

            logger.error({ err: error, traceId: req.traceId, operation: 'previewArticleImport' }, 'Failed to preview article import');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'No se pudo generar el preview del archivo de importación', error, req.traceId);
        }
    });

    router.post('/admin/articles/import/batch', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const previewId = typeof req.body?.previewId === 'string' ? req.body.previewId : '';
        const rowNumbers = Array.isArray(req.body?.rowNumbers)
            ? req.body.rowNumbers.map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value))
            : undefined;

        if (!previewId) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'previewId es obligatorio', undefined, req.traceId);
        }

        try {
            const result = await service.commitPreviewBatch(previewId, rowNumbers);
            return res.status(201).json(result);
        } catch (error: any) {
            if (error?.message === 'PREVIEW_NOT_FOUND') {
                return sendError(res, 404, ErrorCodes.NOT_FOUND, 'La sesión de preview no se encontró o expiró', undefined, req.traceId);
            }
            if (error instanceof MissingOptionalCatalogDefaultsError) {
                return sendError(
                    res,
                    422,
                    ErrorCodes.VALIDATION_FAILED,
                    `Faltan catálogos default configurados (${error.missingCatalogs.join(', ')}). Crear registros base para continuar.`,
                    { configuredDefaults: ['family=06', 'material=99', 'category=99', 'classification=99', 'garmentType=99'] },
                    req.traceId
                );
            }
            logger.error({ err: error, traceId: req.traceId, operation: 'commitArticleImportBatch' }, 'Failed to import article batch');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'No se pudo procesar el lote de importación', error, req.traceId);
        }
    });

    router.post('/admin/articles/import/commit', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const previewId = typeof req.body?.previewId === 'string' ? req.body.previewId : '';
        const rowNumbers = Array.isArray(req.body?.rowNumbers)
            ? req.body.rowNumbers.map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value))
            : undefined;

        if (!previewId) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'previewId es obligatorio', undefined, req.traceId);
        }

        try {
            const result = await service.commitPreview(previewId, rowNumbers);
            return res.status(201).json(result);
        } catch (error: any) {
            if (error?.message === 'PREVIEW_NOT_FOUND') {
                return sendError(res, 404, ErrorCodes.NOT_FOUND, 'La sesión de preview no se encontró o expiró', undefined, req.traceId);
            }
            if (error instanceof MissingOptionalCatalogDefaultsError) {
                return sendError(
                    res,
                    422,
                    ErrorCodes.VALIDATION_FAILED,
                    `Faltan catálogos default configurados (${error.missingCatalogs.join(', ')}). Crear registros base para continuar.`,
                    { configuredDefaults: ['family=06', 'material=99', 'category=99', 'classification=99', 'garmentType=99'] },
                    req.traceId
                );
            }
            logger.error({ err: error, traceId: req.traceId, operation: 'commitArticleImport' }, 'Failed to commit article import');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'No se pudo confirmar la importación del archivo', error, req.traceId);
        }
    });

    return router;
};
