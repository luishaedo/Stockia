import { RequestHandler, Router } from 'express';
import {
    CommitDragonfishImportSchema,
    CreateDragonfishEquivalenceSchema,
    DragonfishEquivalenceQuerySchema,
    ErrorCodes,
    UpdateDragonfishEquivalenceSchema
} from '@stockia/shared';
import { logger } from '../lib/logger.js';
import { sendError } from '../middlewares/error.js';
import { MultipartValidationError, runSingleFileUpload } from '../middlewares/upload.js';
import {
    DragonfishEquivalenceError,
    DragonfishEquivalenceService
} from '../services/dragonfishEquivalenceService.js';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.csv', '.xls', '.xlsx']);

export const createDragonfishEquivalenceRoutes = (
    service: DragonfishEquivalenceService,
    requireAuth: RequestHandler,
    readRateLimitMiddleware: RequestHandler,
    writeRateLimitMiddleware: RequestHandler
) => {
    const router = Router();

    const handleError = (error: unknown, req: any, res: any) => {
        if (error instanceof DragonfishEquivalenceError) {
            return sendError(res, error.status, error.code, error.message, error.details, req.traceId);
        }
        logger.error({ err: error, traceId: req.traceId }, 'Dragonfish equivalence operation failed');
        return sendError(
            res,
            500,
            ErrorCodes.INTERNAL_SERVER_ERROR,
            'No se pudo completar la operación de equivalencias Dragonfish',
            undefined,
            req.traceId
        );
    };

    router.get('/dragonfish-equivalences', readRateLimitMiddleware, requireAuth, async (req, res) => {
        const validation = DragonfishEquivalenceQuerySchema.safeParse(req.query);
        if (!validation.success) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Parámetros inválidos', validation.error.format(), req.traceId);
        }
        try {
            return res.json(await service.list(validation.data));
        } catch (error) {
            return handleError(error, req, res);
        }
    });

    router.post('/dragonfish-equivalences', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const validation = CreateDragonfishEquivalenceSchema.safeParse(req.body);
        if (!validation.success) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Datos inválidos', validation.error.format(), req.traceId);
        }
        try {
            return res.status(201).json(await service.create(validation.data));
        } catch (error) {
            return handleError(error, req, res);
        }
    });

    router.put('/dragonfish-equivalences/:id', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const validation = UpdateDragonfishEquivalenceSchema.safeParse(req.body);
        if (!validation.success) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Datos inválidos', validation.error.format(), req.traceId);
        }
        try {
            return res.json(await service.update(req.params.id, validation.data.dragonfishCode));
        } catch (error) {
            return handleError(error, req, res);
        }
    });

    router.delete('/dragonfish-equivalences/:id', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        try {
            await service.delete(req.params.id);
            return res.status(204).send();
        } catch (error) {
            return handleError(error, req, res);
        }
    });

    router.get('/dragonfish-equivalences/import/template', readRateLimitMiddleware, requireAuth, async (req, res) => {
        try {
            const workbook = service.buildImportTemplateWorkbook();
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="plantilla-equivalencias-dragonfish.xlsx"`);
            return res.send(workbook);
        } catch (error) {
            return handleError(error, req, res);
        }
    });

    router.post('/dragonfish-equivalences/import/preview', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        try {
            const file = await runSingleFileUpload(req, {
                fieldName: 'file',
                maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
                allowedExtensions: ALLOWED_EXTENSIONS
            });
            return res.json(await service.buildImportPreview(file.buffer, file.originalname));
        } catch (error) {
            if (error instanceof MultipartValidationError) {
                return sendError(
                    res,
                    400,
                    ErrorCodes.VALIDATION_FAILED,
                    'Seleccioná un archivo CSV, XLS o XLSX válido de hasta 10MB',
                    undefined,
                    req.traceId
                );
            }
            return handleError(error, req, res);
        }
    });

    router.post('/dragonfish-equivalences/import/commit', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const validation = CommitDragonfishImportSchema.safeParse(req.body);
        if (!validation.success) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Datos inválidos', validation.error.format(), req.traceId);
        }
        try {
            return res.json(await service.commitImport(validation.data.previewId, validation.data.rowNumbers));
        } catch (error) {
            return handleError(error, req, res);
        }
    });

    router.get('/facturas/:id/dragonfish-export', readRateLimitMiddleware, requireAuth, async (req, res) => {
        try {
            const result = await service.buildInvoiceExport(req.params.id);
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
            return res.send(result.content);
        } catch (error) {
            return handleError(error, req, res);
        }
    });

    return router;
};
