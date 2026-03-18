import { randomUUID } from 'node:crypto';
import { RequestHandler, Router } from 'express';
import { ErrorCodes } from '@stockia/shared';
import { sendError } from '../middlewares/error.js';
import { MultipartValidationError, runSingleFileUpload } from '../middlewares/upload.js';

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
        try {
            const uploadedFile = await runSingleFileUpload(req, {
                fieldName: 'file',
                maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
                allowedMimeTypes
            });

            const sanitizedFilename = uploadedFile.originalname.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
            const uploaded = await uploadToCloudinary({
                filename: `${randomUUID()}-${sanitizedFilename}`,
                mimeType: uploadedFile.mimetype.toLowerCase(),
                content: uploadedFile.buffer
            });

            return res.status(201).json({ url: uploaded.url, publicId: uploaded.publicId, mimeType: uploadedFile.mimetype.toLowerCase() });
        } catch (error) {
            if (error instanceof MultipartValidationError) {
                if (error.code === 'INVALID_CONTENT_TYPE') {
                    return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Content-Type must be multipart/form-data', undefined, req.traceId);
                }

                if (error.code === 'FILE_TOO_LARGE') {
                    return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Logo file exceeds 4MB limit', undefined, req.traceId);
                }

                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Field file is required and must be PNG, JPG, WEBP or SVG', undefined, req.traceId);
            }

            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Could not upload logo', error, req.traceId);
        }
    });

    return router;
};
