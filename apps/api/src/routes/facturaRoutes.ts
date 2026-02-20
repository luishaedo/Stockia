import { RequestHandler, Router } from 'express';
import { FacturaController } from '../controllers/facturaController.js';

export const createFacturaRoutes = (
    controller: FacturaController,
    requireAdminToken: RequestHandler,
    readRateLimitMiddleware: RequestHandler,
    writeRateLimitMiddleware: RequestHandler
) => {
    const router = Router();

    router.get('/facturas', readRateLimitMiddleware, requireAdminToken, controller.list);
    router.get('/facturas/:id', readRateLimitMiddleware, requireAdminToken, controller.getById);
    router.post('/facturas', writeRateLimitMiddleware, requireAdminToken, controller.create);
    router.patch('/facturas/:id/draft', writeRateLimitMiddleware, requireAdminToken, controller.updateDraft);
    router.patch('/facturas/:id/finalize', writeRateLimitMiddleware, requireAdminToken, controller.finalize);

    return router;
};
