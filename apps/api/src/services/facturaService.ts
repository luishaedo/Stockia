import { Prisma } from '@prisma/client';
import {
    CreateFacturaDTO,
    ErrorCodes,
    Factura,
    FacturaEstado,
    FacturaFilters,
    FacturaItem,
    FacturaListResponse,
    UpdateFacturaDraftDTO,
} from '@stockia/shared';
import { FacturaRepository } from '../repositories/facturaRepository.js';
import { mergeItems, validateFacturaIntegrity } from '../utils/factura.js';

export class DomainError extends Error {
    constructor(public readonly code: string, message: string, public readonly status = 400, public readonly details?: unknown) {
        super(message);
    }
}

export class FacturaService {
    constructor(private readonly repository: FacturaRepository) {}

    async listFacturas(filters: FacturaFilters): Promise<FacturaListResponse> {
        const { total, facturas } = await this.repository.list(filters);
        return {
            items: facturas as any as Factura[],
            pagination: {
                page: filters.page || 1,
                pageSize: filters.pageSize || 50,
                total,
                totalPages: Math.ceil(total / (filters.pageSize || 50))
            }
        };
    }

    async getFacturaById(id: string) {
        const factura = await this.repository.findById(id);
        if (!factura) {
            throw new DomainError(ErrorCodes.NOT_FOUND, 'Factura not found', 404);
        }
        return factura;
    }

    async createFacturaDraft(body: CreateFacturaDTO) {
        let processedItems: FacturaItem[] = [];
        if (body.items) {
            try {
                processedItems = mergeItems(body.items, 'ERROR');
            } catch (error) {
                throw new DomainError(ErrorCodes.DUPLICATE_ITEM_COLOR_IN_PAYLOAD, (error as Error).message, 400);
            }
        }

        try {
            return await this.repository.createDraft({
                nroFactura: body.nroFactura,
                proveedor: body.proveedor,
                items: processedItems
            });
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw new DomainError(ErrorCodes.UNIQUE_CONSTRAINT_VIOLATION, 'Unique Constraint Violation', 409);
            }
            throw error;
        }
    }

    async updateFacturaDraft(id: string, body: UpdateFacturaDraftDTO) {
        const duplicateHandler = body.duplicateHandler || 'ERROR';

        let processedItems: FacturaItem[] = [];
        if (body.items) {
            try {
                processedItems = mergeItems(body.items, duplicateHandler);
            } catch (error) {
                throw new DomainError(ErrorCodes.DUPLICATE_ITEM_COLOR_IN_PAYLOAD, (error as Error).message, 400);
            }
        }

        return this.repository.runDraftTransaction(id, async (tx: Prisma.TransactionClient) => {
            const currentFactura = await tx.factura.findUnique({ where: { id } });
            if (!currentFactura) {
                throw new DomainError(ErrorCodes.NOT_FOUND, 'Factura not found', 404);
            }

            if (currentFactura.estado === FacturaEstado.FINAL) {
                throw new DomainError(ErrorCodes.INVOICE_FINAL_READ_ONLY, 'Cannot edit finalized invoice', 409);
            }

            if (body.expectedUpdatedAt) {
                const currentUpdated = new Date(currentFactura.updatedAt).toISOString();
                const expected = new Date(body.expectedUpdatedAt).toISOString();
                if (currentUpdated !== expected) {
                    throw new DomainError(
                        ErrorCodes.OPTIMISTIC_LOCK_CONFLICT,
                        'Conflict: Data has changed since last retrieval',
                        409
                    );
                }
            }

            await tx.factura.update({ where: { id }, data: { proveedor: body.proveedor } });

            if (body.items) {
                await this.repository.syncDraftItems(tx, id, processedItems);
            }

            return tx.factura.findUnique({ where: { id }, include: { items: { include: { colores: true } } } });
        });
    }

    async finalizeFactura(id: string) {
        const factura = await this.repository.findById(id);
        if (!factura) {
            throw new DomainError(ErrorCodes.NOT_FOUND, 'Factura not found', 404);
        }

        if (factura.estado === FacturaEstado.FINAL) {
            throw new DomainError(ErrorCodes.INVOICE_ALREADY_FINALIZED, 'Invoice already finalized', 400);
        }

        const integrityError = validateFacturaIntegrity(factura);
        if (integrityError) {
            throw new DomainError(ErrorCodes.INVOICE_FINALIZE_INVALID, integrityError, 422);
        }

        return this.repository.updateToFinal(id);
    }
}
