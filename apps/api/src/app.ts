import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { requestLoggerMiddleware } from './middlewares/requestLogger.js';
import { requireAdminToken } from './middlewares/auth.js';
import { createFacturaRoutes } from './routes/facturaRoutes.js';
import { FacturaRepository } from './repositories/facturaRepository.js';
import { FacturaService } from './services/facturaService.js';
import { FacturaController } from './controllers/facturaController.js';

export const createApp = (prisma: PrismaClient, adminToken?: string) => {
    const app = express();

    app.use(cors());
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use(requestLoggerMiddleware);

    const repository = new FacturaRepository(prisma);
    const service = new FacturaService(repository);
    const controller = new FacturaController(service);

    app.use(createFacturaRoutes(controller, requireAdminToken(adminToken)));

    return app;
};
