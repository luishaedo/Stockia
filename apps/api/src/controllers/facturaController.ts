import { Request, Response } from 'express';
import {
    AdminInvoiceUserQuerySchema,
    AdminInvoicesQuerySchema,
    CreateFacturaSchema,
    ErrorCodes,
    FacturaFilters,
    FacturaListQuerySchema,
    FinalizeFacturaSchema,
    UpdateFacturaDraftSchema
} from '@stockia/shared';
import { logger } from '../lib/logger.js';
import { sendError } from '../middlewares/error.js';
import { DomainError, FacturaService } from '../services/facturaService.js';

export class FacturaController {
    constructor(private readonly service: FacturaService) {}

    list = async (req: Request, res: Response) => {
        try {
            const validation = FacturaListQuerySchema.safeParse(req.query);
            if (!validation.success) {
                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Validation Failed', validation.error.format(), req.traceId);
            }

            const filters: FacturaFilters = validation.data;

            const response = await this.service.listFacturas(filters);
            res.json(response);
        } catch (error) {
            logger.error({ err: error, traceId: req.traceId }, 'Error listing facturas');
            sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Internal Server Error', undefined, req.traceId);
        }
    };

    listAdminInvoices = async (req: Request, res: Response) => {
        try {
            const validation = AdminInvoicesQuerySchema.safeParse(req.query);
            if (!validation.success) {
                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Validation Failed', validation.error.format(), req.traceId);
            }

            const response = await this.service.listAdminInvoices(validation.data);
            res.json(response);
        } catch (error) {
            this.handleError(error, req, res);
        }
    };

    listAdminInvoiceUsers = async (req: Request, res: Response) => {
        try {
            const validation = AdminInvoiceUserQuerySchema.safeParse(req.query);
            if (!validation.success) {
                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Validation Failed', validation.error.format(), req.traceId);
            }

            const response = await this.service.listAdminInvoiceUsers(validation.data);
            res.json(response);
        } catch (error) {
            this.handleError(error, req, res);
        }
    };

    getById = async (req: Request, res: Response) => {
        try {
            const factura = await this.service.getFacturaById(req.params.id);
            res.json(factura);
        } catch (error) {
            this.handleError(error, req, res);
        }
    };

    create = async (req: Request, res: Response) => {
        try {
            const validation = CreateFacturaSchema.safeParse(req.body);
            if (!validation.success) {
                const dup = validation.error.issues.find(i => i.message === ErrorCodes.DUPLICATE_ITEM_COLOR_IN_PAYLOAD);
                if (dup) {
                    return sendError(res, 400, ErrorCodes.DUPLICATE_ITEM_COLOR_IN_PAYLOAD, 'Duplicate Item/Color in payload', undefined, req.traceId);
                }
                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Validation Failed', validation.error.format(), req.traceId);
            }

            const factura = await this.service.createFacturaDraft(validation.data, req.authUser?.sub);
            res.status(201).json(factura);
        } catch (error) {
            this.handleError(error, req, res);
        }
    };

    updateDraft = async (req: Request, res: Response) => {
        try {
            const validation = UpdateFacturaDraftSchema.safeParse(req.body);
            if (!validation.success) {
                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Validation Failed', validation.error.format(), req.traceId);
            }

            const factura = await this.service.updateFacturaDraft(req.params.id, validation.data);
            res.json(factura);
        } catch (error) {
            this.handleError(error, req, res);
        }
    };

    finalize = async (req: Request, res: Response) => {
        try {
            const validation = FinalizeFacturaSchema.safeParse(req.body);
            if (!validation.success) {
                return sendError(res, 400, ErrorCodes.VALIDATION_FAILED, 'Validation Failed', validation.error.format(), req.traceId);
            }

            const factura = await this.service.finalizeFactura(req.params.id, validation.data.expectedUpdatedAt);
            res.json(factura);
        } catch (error) {
            this.handleError(error, req, res);
        }
    };

    private handleError(error: unknown, req: Request, res: Response) {
        if (error instanceof DomainError) {
            logger.warn(
                {
                    traceId: req.traceId,
                    code: error.code,
                    status: error.status,
                    details: error.details,
                    path: req.path,
                    method: req.method
                },
                'Domain validation error in factura flow'
            );
            return sendError(res, error.status, error.code, error.message, error.details, req.traceId);
        }

        logger.error({ err: error, traceId: req.traceId, path: req.path, method: req.method }, 'Unhandled controller error');
        return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Internal Server Error', undefined, req.traceId);
    }
}
