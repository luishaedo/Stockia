import multer, { MulterError } from 'multer';
import type { Request, RequestHandler } from 'express';

export type SingleFileUploadOptions = {
    fieldName: string;
    maxFileSizeBytes: number;
    allowedMimeTypes?: ReadonlySet<string>;
    allowedExtensions?: ReadonlySet<string>;
};

export type MultipartValidationErrorCode =
    | 'INVALID_CONTENT_TYPE'
    | 'FILE_REQUIRED'
    | 'FILE_TOO_LARGE'
    | 'INVALID_FILE_TYPE';

export class MultipartValidationError extends Error {
    constructor(
        public readonly code: MultipartValidationErrorCode,
        message?: string
    ) {
        super(message ?? code);
        this.name = 'MultipartValidationError';
    }
}

const getNormalizedExtension = (filename?: string) => {
    if (!filename || !filename.includes('.')) {
        return '';
    }

    return `.${filename.split('.').pop()?.toLowerCase() ?? ''}`;
};

const buildMulterMiddleware = (options: SingleFileUploadOptions) => {
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: options.maxFileSizeBytes },
        fileFilter: (_req, file, callback) => {
            const normalizedMimeType = file.mimetype.toLowerCase();
            const normalizedExtension = getNormalizedExtension(file.originalname);

            if (options.allowedMimeTypes && !options.allowedMimeTypes.has(normalizedMimeType)) {
                callback(new MultipartValidationError('INVALID_FILE_TYPE'));
                return;
            }

            if (options.allowedExtensions && !options.allowedExtensions.has(normalizedExtension)) {
                callback(new MultipartValidationError('INVALID_FILE_TYPE'));
                return;
            }

            callback(null, true);
        }
    });

    return upload.single(options.fieldName);
};

const isMultipartFormData = (req: Request) => req.is('multipart/form-data');

export const runSingleFileUpload = (req: Request, options: SingleFileUploadOptions) => {
    if (!isMultipartFormData(req)) {
        throw new MultipartValidationError('INVALID_CONTENT_TYPE');
    }

    const middleware = buildMulterMiddleware(options);

    return new Promise<Express.Multer.File>((resolve, reject) => {
        middleware(req, {} as never, (error?: unknown) => {
            if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
                reject(new MultipartValidationError('FILE_TOO_LARGE'));
                return;
            }

            if (error) {
                reject(error);
                return;
            }

            if (!req.file) {
                reject(new MultipartValidationError('FILE_REQUIRED'));
                return;
            }

            resolve(req.file);
        });
    });
};

export const createMultipartGuard = (): RequestHandler => (req, _res, next) => {
    if (!isMultipartFormData(req)) {
        next(new MultipartValidationError('INVALID_CONTENT_TYPE'));
        return;
    }

    next();
};
