import { RequestHandler, Router } from 'express';
import { FacturaController } from '../controllers/facturaController.js';

export const createFacturaRoutes = (
    controller: FacturaController,
    requireAdminToken: RequestHandler,
    readRateLimitMiddleware: RequestHandler,
    writeRateLimitMiddleware: RequestHandler
) => {
    const router = Router();

    router.get('/facturas', readRateLimitMiddleware, controller.list);
    router.get('/invoices/by-article/:articleId', readRateLimitMiddleware, controller.listByArticle);
    router.delete('/facturas/:id', writeRateLimitMiddleware, requireAdminToken, controller.deleteInvoice);
    router.delete('/admin/invoices/:id', writeRateLimitMiddleware, requireAdminToken, controller.deleteAdminInvoice);
    router.patch('/admin/invoices/:id/export', writeRateLimitMiddleware, requireAdminToken, controller.exportAdminInvoice);
    router.get('/admin/invoices', readRateLimitMiddleware, requireAdminToken, controller.listAdminInvoices);
    router.get('/admin/invoice-users', readRateLimitMiddleware, requireAdminToken, controller.listAdminInvoiceUsers);
    router.get('/facturas/:id', readRateLimitMiddleware, controller.getById);
    router.post('/facturas', writeRateLimitMiddleware, requireAdminToken, controller.create);
    router.patch('/facturas/:id/draft', writeRateLimitMiddleware, requireAdminToken, controller.updateDraft);
    router.patch('/facturas/:id/finalize', writeRateLimitMiddleware, requireAdminToken, controller.finalize);

    return router;
};
