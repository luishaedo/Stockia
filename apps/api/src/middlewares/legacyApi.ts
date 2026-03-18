import { NextFunction, Request, RequestHandler, Response } from 'express';
import { logger } from '../lib/logger.js';

const LEGACY_API_SUNSET = 'Wed, 30 Sep 2026 23:59:59 GMT';

const buildCanonicalApiPath = (req: Request) => {
    const originalUrl = req.originalUrl || req.url || '/';
    const canonicalPath = `/api${originalUrl.startsWith('/') ? originalUrl : `/${originalUrl}`}`;
    return canonicalPath.replace(/\/{2,}/g, '/');
};

export const legacyApiDeprecationMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const canonicalPath = buildCanonicalApiPath(req);

    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', LEGACY_API_SUNSET);
    res.setHeader('Link', `<${canonicalPath}>; rel="successor-version"`);

    logger.warn(
        {
            traceId: req.traceId,
            method: req.method,
            legacyPath: req.originalUrl,
            canonicalPath,
            sunset: LEGACY_API_SUNSET
        },
        'Legacy root API alias used'
    );

    next();
};
