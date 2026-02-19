import { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger.js';

export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
        logger.info(
            {
                traceId: req.traceId,
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                durationMs: Date.now() - start
            },
            'HTTP request completed'
        );
    });

    next();
};
