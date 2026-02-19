import cors, { CorsOptions } from 'cors';
import { NextFunction, Request, Response } from 'express';

const DEFAULT_DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

type CounterRecord = {
    count: number;
    resetAt: number;
};

const parseAllowedOrigins = () => {
    const rawOrigins = process.env.CORS_ALLOWED_ORIGINS;
    const configuredOrigins = rawOrigins?.split(',').map(origin => origin.trim()).filter(Boolean) ?? [];

    if (configuredOrigins.length > 0) {
        return configuredOrigins;
    }

    return process.env.NODE_ENV === 'production' ? [] : DEFAULT_DEV_ORIGINS;
};

export const buildCorsMiddleware = () => {
    const allowedOrigins = parseAllowedOrigins();
    const allowNoOrigin = process.env.CORS_ALLOW_NO_ORIGIN === 'true';

    const corsOptions: CorsOptions = {
        origin: (origin, callback) => {
            if (!origin) {
                callback(null, allowNoOrigin);
                return;
            }

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error(`CORS blocked for origin: ${origin}`));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'authorization', 'x-request-id']
    };

    return cors(corsOptions);
};

export const securityHeadersMiddleware = (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
};

const createRateLimiter = (maxRequests: number, windowMs: number) => {
    const counters = new Map<string, CounterRecord>();

    setInterval(() => {
        const now = Date.now();
        for (const [key, value] of counters.entries()) {
            if (value.resetAt <= now) {
                counters.delete(key);
            }
        }
    }, windowMs).unref();

    return (req: Request, res: Response, next: NextFunction) => {
        const key = `${req.ip}:${req.method}:${req.route?.path ?? req.path}`;
        const now = Date.now();
        const current = counters.get(key);

        if (!current || current.resetAt <= now) {
            counters.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        current.count += 1;

        if (current.count > maxRequests) {
            res.status(429).json({
                error: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please retry later.'
            });
            return;
        }

        next();
    };
};

export const readRateLimitMiddleware = createRateLimiter(Number(process.env.RATE_LIMIT_READ_MAX ?? 120), 60 * 1000);
export const writeRateLimitMiddleware = createRateLimiter(Number(process.env.RATE_LIMIT_WRITE_MAX ?? 30), 60 * 1000);
