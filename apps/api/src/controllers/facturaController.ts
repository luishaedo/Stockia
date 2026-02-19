import { Request, Response } from 'express';
import {
    CreateFacturaSchema,
    ErrorCodes,
    FacturaEstado,
    FacturaFilters,
    UpdateFacturaDraftSchema
} from '@stockia/shared';
import { logger } from '../lib/logger.js';
import { sendError, toMessage } from '../middlewares/error.js';
import { DomainError, FacturaService } from '../services/facturaService.js';

export class FacturaController {
    constructor(private readonly service: FacturaService) {}

    list = async (req: Request, res: Response) => {
        try {
            const filters: FacturaFilters = {
                nroFactura: req.query.nroFactura as string,
                proveedor: req.query.proveedor as string,
                estado: req.query.estado as FacturaEstado,
                dateFrom: req.query.dateFrom as string,
                dateTo: req.query.dateTo as string,
                page: req.query.page ? parseInt(req.query.page as string) : 1,
                pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 50,
                sortBy: (req.query.sortBy as any) || 'fecha',
                sortDir: (req.query.sortDir as 'asc' | 'desc') || 'desc',
            };

            const response = await this.service.listFacturas(filters);
            res.json(response);
        } catch (error) {
            logger.error({ err: error, traceId: req.traceId }, 'Error listing facturas');
            sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Internal Server Error', undefined, req.traceId);
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

            const factura = await this.service.createFacturaDraft(validation.data);
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
            const factura = await this.service.finalizeFactura(req.params.id);
            res.json(factura);
        } catch (error) {
            this.handleError(error, req, res);
        }
    };

    private handleError(error: unknown, req: Request, res: Response) {
        if (error instanceof DomainError) {
            return sendError(res, error.status, error.code, error.message, error.details, req.traceId);
        }

        logger.error({ err: error, traceId: req.traceId }, 'Unhandled controller error');
        return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, toMessage(error), undefined, req.traceId);
    }
}
