import { NextFunction, Request, Response } from 'express';
import { ErrorCodes } from '@stockia/shared';
import { sendError } from './error.js';

export const requireAdminToken = (adminToken?: string) => (req: Request, res: Response, next: NextFunction) => {
    if (!adminToken) {
        return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Server misconfigured: missing ADMIN_TOKEN', undefined, req.traceId);
    }

    const providedToken = req.header('x-admin-token');

    if (!providedToken) {
        return sendError(res, 401, ErrorCodes.UNAUTHORIZED, 'Missing admin token', undefined, req.traceId);
    }

    if (providedToken !== adminToken) {
        return sendError(res, 403, ErrorCodes.FORBIDDEN, 'Invalid admin token', undefined, req.traceId);
    }

    next();
};
