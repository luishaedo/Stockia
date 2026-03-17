import { randomUUID } from 'node:crypto';
import { RequestHandler, Router } from 'express';
import { ErrorCodes } from '@stockia/shared';
import { sendError } from '../middlewares/error.js';

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

type ParsedMultipartFile = {
    filename: string;
    mimeType: string;
    content: Buffer;
};

type CloudinaryUploadResponse = {
    secure_url?: string;
    public_id?: string;
    error?: {
        message?: string;
    };
};

const getBoundary = (contentTypeHeader?: string) => {
    if (!contentTypeHeader) return null;
    const match = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    const boundary = match?.[1] ?? match?.[2];
    return boundary ? boundary.trim() : null;
};

const parseMultipartSingleFile = (body: Buffer, boundary: string): ParsedMultipartFile | null => {
    const delimiter = Buffer.from(`--${boundary}`, 'latin1');
    const headerDelimiter = Buffer.from('\r\n\r\n', 'latin1');
    const lineBreak = Buffer.from('\r\n', 'latin1');
    const finalBoundarySuffix = Buffer.from('--', 'latin1');

    let scanIndex = 0;

    while (scanIndex < body.length) {
        const partBoundaryStart = body.indexOf(delimiter, scanIndex);
        if (partBoundaryStart === -1) break;

        const boundaryEnd = partBoundaryStart + delimiter.length;
        const isFinalBoundary = body.subarray(boundaryEnd, boundaryEnd + 2).equals(finalBoundarySuffix);
        if (isFinalBoundary) break;

        const partStart = body.subarray(boundaryEnd, boundaryEnd + 2).equals(lineBreak)
            ? boundaryEnd + 2
            : boundaryEnd;

        const nextBoundaryStart = body.indexOf(delimiter, partStart);
        if (nextBoundaryStart === -1) break;

        const rawPart = body.subarray(partStart, nextBoundaryStart);
        const headerEndIndex = rawPart.indexOf(headerDelimiter);
        if (headerEndIndex === -1) {
            scanIndex = nextBoundaryStart;
            continue;
        }

        const rawHeaders = rawPart.subarray(0, headerEndIndex).toString('latin1');
        if (!rawHeaders.includes('name="file"')) {
            scanIndex = nextBoundaryStart;
            continue;
        }

        const filenameMatch = rawHeaders.match(/filename="([^"]+)"/i);
        const contentTypeMatch = rawHeaders.match(/Content-Type:\s*([^\r\n]+)/i);
        if (!filenameMatch || !contentTypeMatch) return null;

        const mimeType = contentTypeMatch[1].trim().toLowerCase();
        if (!allowedMimeTypes.has(mimeType)) return null;

        const rawContent = rawPart.subarray(headerEndIndex + headerDelimiter.length);
        const hasTrailingLineBreak = rawContent.length >= 2 && rawContent.subarray(rawContent.length - 2).equals(lineBreak);
        const content = hasTrailingLineBreak
            ? rawContent.subarray(0, rawContent.length - 2)
            : rawContent;

        const sanitizedFilename = filenameMatch[1].replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();

        return {
            filename: `${randomUUID()}-${sanitizedFilename}`,
            mimeType,
            content
        };
    }

    return null;
};

const uploadToCloudinary = async (file: ParsedMultipartFile) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const folder = process.env.CLOUDINARY_UPLOAD_FOLDER ?? 'stockia/suppliers';

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('Cloudinary env vars are required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
    }

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const formData = new FormData();
    formData.append('folder', folder);
    formData.append('resource_type', 'image');
    formData.append('use_filename', 'true');
    formData.append('unique_filename', 'true');
    formData.append('overwrite', 'false');
    formData.append('file', new Blob([new Uint8Array(file.content)], { type: file.mimeType }), file.filename);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`
        },
        body: formData
    });

    const data = await response.json() as CloudinaryUploadResponse;

    if (!response.ok || !data.secure_url || !data.public_id) {
        throw new Error(data.error?.message ?? 'Could not upload logo to Cloudinary');
    }

    return {
        url: data.secure_url,
        publicId: data.public_id
    };
};

export const createAdminUploadRoutes = (
    requireAuth: RequestHandler,
    writeRateLimitMiddleware: RequestHandler
) => {
    const router = Router();

    router.post('/admin/uploads/logo', writeRateLimitMiddleware, requireAuth, async (req, res) => {
        const boundary = getBoundary(req.headers['content-type']);
        if (!boundary) {
            return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Content-Type must be multipart/form-data', undefined, req.traceId);
        }

        try {
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

            const rawBody = Buffer.concat(chunks);
            const parsedFile = parseMultipartSingleFile(rawBody, boundary);

            if (!parsedFile) {
                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Field file is required and must be PNG, JPG, WEBP or SVG', undefined, req.traceId);
            }

            if (parsedFile.content.length > MAX_FILE_SIZE_BYTES) {
                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Logo file exceeds 4MB limit', undefined, req.traceId);
            }

            const uploaded = await uploadToCloudinary(parsedFile);
            return res.status(201).json({ url: uploaded.url, publicId: uploaded.publicId, mimeType: parsedFile.mimeType });
        } catch (error) {
            const message = error instanceof Error && error.message.includes('too large')
                ? 'Logo file exceeds 4MB limit'
                : 'Could not upload logo';

            return sendError(
                res,
                message === 'Could not upload logo' ? 500 : 400,
                message === 'Could not upload logo' ? ErrorCodes.INTERNAL_SERVER_ERROR : ErrorCodes.VALIDATION_FAILED,
                message,
                error,
                req.traceId
            );
        }
    });

    return router;
};
