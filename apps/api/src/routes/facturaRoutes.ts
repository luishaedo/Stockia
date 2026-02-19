import { RequestHandler, Router } from 'express';
import { FacturaController } from '../controllers/facturaController.js';

export const createFacturaRoutes = (controller: FacturaController, requireAdminToken: RequestHandler) => {
    const router = Router();

    router.get('/facturas', controller.list);
    router.get('/facturas/:id', controller.getById);
    router.post('/facturas', requireAdminToken, controller.create);
    router.patch('/facturas/:id/draft', requireAdminToken, controller.updateDraft);
    router.patch('/facturas/:id/finalize', requireAdminToken, controller.finalize);

    return router;
};
