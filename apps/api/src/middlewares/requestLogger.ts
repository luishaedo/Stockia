import { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger.js';
import { observeHttpRequest } from '../lib/metrics.js';

export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
        const durationMs = Date.now() - start;

        observeHttpRequest(req, res.statusCode, durationMs);

        logger.info(
            {
                traceId: req.traceId,
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                durationMs
            },
            'HTTP request completed'
        );
    });

    next();
};
