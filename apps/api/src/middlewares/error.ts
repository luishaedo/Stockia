import { Response } from 'express';
import { ApiErrorBody } from '@stockia/shared';
import { observeHttpError } from '../lib/metrics.js';

export const sendError = (
    res: Response,
    status: number,
    code: string,
    message: string,
    details?: unknown,
    traceId?: string
) => {
    const req = res.req;
    if (req) {
        observeHttpError(req, code);
    }

    const error: ApiErrorBody = {
        code,
        message,
        details,
        traceId,
    };

    return res.status(status).json({ error });
};

export const toMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return 'Unknown error';
};
