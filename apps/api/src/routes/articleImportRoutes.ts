import { RequestHandler, Router } from 'express';
import { ErrorCodes } from '@stockia/shared';
import { logger } from '../lib/logger.js';
import { sendError } from '../middlewares/error.js';
import { ArticleImportService } from '../services/articleImportService.js';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.csv', '.xls', '.xlsx']);

type ParsedMultipartFile = {
    filename: string;
    content: Buffer;
};

const getBoundary = (contentTypeHeader?: string) => {
    if (!contentTypeHeader) return null;
    const match = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    return (match?.[1] ?? match?.[2] ?? '').trim() || null;
};

const parseMultipartSingleFile = (body: Buffer, boundary: string): ParsedMultipartFile | null => {
    const bodyText = body.toString('latin1');
    const delimiter = `--${boundary}`;
    const segments = bodyText.split(delimiter).map(segment => segment.trim());

    for (const segment of segments) {
        if (!segment || segment === '--') continue;
        const headerEndIndex = segment.indexOf('\r\n\r\n');
        if (headerEndIndex === -1) continue;

        const rawHeaders = segment.slice(0, headerEndIndex);
        const contentText = segment.slice(headerEndIndex + 4).replace(/\r\n--$/, '').replace(/\r\n$/, '');
        if (!rawHeaders.includes('name="file"')) continue;

        const filenameMatch = rawHeaders.match(/filename="([^"]+)"/i);
        if (!filenameMatch) return null;

        const filename = filenameMatch[1].trim();
        return {
            filename,
            content: Buffer.from(contentText, 'latin1')
        };
    }

    return null;
};

const readMultipartBody = async (req: Parameters<RequestHandler>[0]) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;

    await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk: Buffer) => {
            totalSize += chunk.length;
            if (totalSize > MAX_FILE_SIZE_BYTES + 1024 * 512) {
                reject(new Error('File too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve());
        req.on('error', reject);
    });

    return Buffer.concat(chunks);
};

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

    router.post('/admin/articles/import/preview', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const boundary = getBoundary(req.headers['content-type']);
        if (!boundary) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Content-Type debe ser multipart/form-data', undefined, req.traceId);
        }

        try {
            const rawBody = await readMultipartBody(req);
            const parsedFile = parseMultipartSingleFile(rawBody, boundary);

            if (!parsedFile) {
                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'El campo file es obligatorio', undefined, req.traceId);
            }

            const extension = parsedFile.filename.toLowerCase().slice(parsedFile.filename.lastIndexOf('.'));
            if (!ALLOWED_EXTENSIONS.has(extension)) {
                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'La extensión del archivo debe ser .csv, .xls o .xlsx', undefined, req.traceId);
            }

            if (parsedFile.content.length > MAX_FILE_SIZE_BYTES) {
                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'El archivo de importación supera el límite de 10MB', undefined, req.traceId);
            }

            const preview = await service.buildPreview(parsedFile.content, parsedFile.filename);
            return res.json(preview);
        } catch (error) {
            logger.error({ err: error, traceId: req.traceId, operation: 'previewArticleImport' }, 'Failed to preview article import');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'No se pudo generar el preview del archivo de importación', error, req.traceId);
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
            logger.error({ err: error, traceId: req.traceId, operation: 'commitArticleImport' }, 'Failed to commit article import');
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'No se pudo confirmar la importación del archivo', error, req.traceId);
        }
    });

    return router;
};
