import { Response } from 'express';
import { ApiErrorBody } from '@stockia/shared';

export const sendError = (
    res: Response,
    status: number,
    code: string,
    message: string,
    details?: unknown,
    traceId?: string
) => {
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
