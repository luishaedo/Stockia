import express from 'express';
import path from 'node:path';
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
import { createAdminUploadRoutes } from './routes/adminUploadRoutes.js';
import { createCatalogSelectionRoutes } from './routes/catalogSelectionRoutes.js';
import { createArticleRoutes } from './routes/articleRoutes.js';
import { createArticleImportRoutes } from './routes/articleImportRoutes.js';
import { FacturaRepository } from './repositories/facturaRepository.js';
import { FacturaService } from './services/facturaService.js';
import { FacturaController } from './controllers/facturaController.js';
import { ArticleImportService } from './services/articleImportService.js';
import { AuthService } from './services/authService.js';
import { sendError } from './middlewares/error.js';
import { getPrometheusMetrics } from './lib/metrics.js';
import { legacyApiDeprecationMiddleware } from './middlewares/legacyApi.js';

export const createApp = (prisma: PrismaClient) => {
    const app = express();
    app.set('trust proxy', 1);

    const authMiddleware = requireAuthToken(process.env.JWT_SECRET);
    const authService = new AuthService(prisma);

    app.use(buildCorsMiddleware());
    app.use(securityHeadersMiddleware);
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use(requestLoggerMiddleware);
    app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

    app.get('/health', (_req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    app.get('/metrics', (_req, res) => {
        res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.status(200).send(getPrometheusMetrics());
    });

    const authLoginHandler: express.RequestHandler = async (req, res) => {
        const { username, password } = req.body ?? {};
        const configuredUsername = process.env.AUTH_USERNAME;
        const configuredPassword = process.env.AUTH_PASSWORD;

        if (!configuredUsername || !configuredPassword) {
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Server misconfigured', undefined, req.traceId);
        }

        try {
            const identity = await authService.authenticate({
                username: String(username ?? ''),
                password: String(password ?? ''),
                bootstrapUsername: configuredUsername,
                bootstrapPassword: configuredPassword
            });

            if (!identity) {
                return sendError(res, 401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid credentials', undefined, req.traceId);
            }

            const accessToken = await issueAuthToken({
                userId: identity.userId,
                sub: identity.username,
                username: identity.username,
                role: 'admin',
                roles: identity.roles,
                scopes: identity.scopes
            }, process.env.JWT_SECRET);

            return res.json({ accessToken, tokenType: 'Bearer' });
        } catch (error) {
            return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Server misconfigured', error, req.traceId);
        }
    };

    app.post('/api/auth/login', loginRateLimitMiddleware, authLoginHandler);
    app.post('/auth/login', loginRateLimitMiddleware, legacyApiDeprecationMiddleware, authLoginHandler);

    const repository = new FacturaRepository(prisma);
    const service = new FacturaService(repository);
    const controller = new FacturaController(service);
    const articleImportService = new ArticleImportService(prisma);

    const facturaRoutes = createFacturaRoutes(controller, authMiddleware, readRateLimitMiddleware, writeRateLimitMiddleware);
    const catalogSelectionRoutes = createCatalogSelectionRoutes(prisma, readRateLimitMiddleware);
    const articleRoutes = createArticleRoutes(prisma, authMiddleware, readRateLimitMiddleware, writeRateLimitMiddleware);
    const adminCatalogRoutes = createAdminCatalogRoutes(
        prisma,
        authMiddleware,
        readRateLimitMiddleware,
        writeRateLimitMiddleware
    );
    const adminUploadRoutes = createAdminUploadRoutes(authMiddleware, writeRateLimitMiddleware);
    const articleImportRoutes = createArticleImportRoutes(articleImportService, authMiddleware, writeRateLimitMiddleware);

    app.use('/api', facturaRoutes);
    app.use('/api', catalogSelectionRoutes);
    app.use('/api', articleRoutes);
    app.use('/api', adminCatalogRoutes);
    app.use('/api', adminUploadRoutes);
    app.use('/api', articleImportRoutes);

    app.use(legacyApiDeprecationMiddleware, facturaRoutes);
    app.use(legacyApiDeprecationMiddleware, catalogSelectionRoutes);
    app.use(legacyApiDeprecationMiddleware, articleRoutes);
    app.use(legacyApiDeprecationMiddleware, adminCatalogRoutes);
    app.use(legacyApiDeprecationMiddleware, adminUploadRoutes);
    app.use(legacyApiDeprecationMiddleware, articleImportRoutes);

    return app;
};
