import express from 'express';
import { PrismaClient } from '@prisma/client';
import { ErrorCodes } from '@stockia/shared';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { requestLoggerMiddleware } from './middlewares/requestLogger.js';
import { issueAuthToken, requireAuthToken } from './middlewares/auth.js';
import {
    buildCorsMiddleware,
    loginRateLimitMiddleware,
    readRateLimitMiddleware,
    securityHeadersMiddleware,
    writeRateLimitMiddleware
} from './middlewares/security.js';
import { createFacturaRoutes } from './routes/facturaRoutes.js';
import { createAdminCatalogRoutes } from './routes/adminCatalogRoutes.js';
import { FacturaRepository } from './repositories/facturaRepository.js';
import { FacturaService } from './services/facturaService.js';
import { FacturaController } from './controllers/facturaController.js';
import { sendError } from './middlewares/error.js';

export const createApp = (prisma: PrismaClient) => {
    const app = express();
    app.set('trust proxy', 1);

    app.use(buildCorsMiddleware());
    app.use(securityHeadersMiddleware);
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use(requestLoggerMiddleware);

    app.get('/health', (_req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    app.post('/auth/login', loginRateLimitMiddleware, (req, res) => {
        const { username, password } = req.body ?? {};
        const configuredUsername = process.env.AUTH_USERNAME;
        const configuredPassword = process.env.AUTH_PASSWORD;

        if (!configuredUsername || !configuredPassword) {
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Server misconfigured', undefined, req.traceId);
        }

        if (username !== configuredUsername || password !== configuredPassword) {
            return sendError(res, 401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid credentials', undefined, req.traceId);
        }

        const accessToken = issueAuthToken({ sub: username, role: 'admin' }, process.env.JWT_SECRET);
        return res.json({ accessToken, tokenType: 'Bearer' });
    });

    const repository = new FacturaRepository(prisma);
    const service = new FacturaService(repository);
    const controller = new FacturaController(service);

    app.use(createFacturaRoutes(controller, requireAuthToken(process.env.JWT_SECRET), readRateLimitMiddleware, writeRateLimitMiddleware));
    app.use(createAdminCatalogRoutes(prisma, requireAuthToken(process.env.JWT_SECRET), readRateLimitMiddleware, writeRateLimitMiddleware));

    return app;
};
