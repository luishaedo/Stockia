import { Prisma } from '@prisma/client';
import {
    AdminInvoiceListResponse,
    AdminInvoicesQuery,
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

const normalizedValues = (values: string[]) => values.map(value => value.trim()).filter(Boolean);

const hasExactValues = (left: string[], right: string[]) => {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
};

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

    async listAdminInvoices(filters: AdminInvoicesQuery): Promise<AdminInvoiceListResponse> {
        const [total, invoices] = await this.repository.listAdminInvoices(filters);
        return {
            items: invoices.map(invoice => ({
                id: invoice.id,
                number: invoice.nroFactura,
                supplier: invoice.proveedor,
                status: invoice.estado,
                createdAt: invoice.createdAt,
                createdBy: invoice.createdBy
                    ? {
                        id: invoice.createdBy,
                        name: invoice.createdBy,
                        email: null
                    }
                    : null
            })),
            pagination: {
                page: filters.page,
                pageSize: filters.pageSize,
                total
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

    private async validateCatalogSelections(proveedor: string | undefined, items: FacturaItem[]) {
        if (!proveedor || !proveedor.trim()) {
            throw new DomainError(
                ErrorCodes.VALIDATION_FAILED,
                'Supplier is required. Select an existing supplier or create one first.',
                422
            );
        }

        const supplier = await this.repository.findSupplierBySelection(proveedor);
        if (!supplier) {
            throw new DomainError(
                ErrorCodes.VALIDATION_FAILED,
                'Invalid supplier. Select an existing supplier or create one first.',
                422
            );
        }

        if (items.length === 0) return items;

        const curves = await this.repository.findAllSizeCurves();
        if (curves.length === 0) {
            throw new DomainError(
                ErrorCodes.VALIDATION_FAILED,
                'No size tables available. Create a size table first.',
                422
            );
        }

        for (const item of items) {
            const inputCurveValues = normalizedValues(item.curvaTalles);
            const hasMatchingCurve = curves.some(curve => {
                const catalogValues = curve.values.map(value => value.value);
                return hasExactValues(catalogValues, inputCurveValues);
            });

            if (!hasMatchingCurve) {
                throw new DomainError(
                    ErrorCodes.VALIDATION_FAILED,
                    `Invalid size curve for item ${item.codigoArticulo}. Select an existing size table.`,
                    422
                );
            }
        }

        return items;
    }

    async createFacturaDraft(body: CreateFacturaDTO, createdBy?: string) {
        let processedItems: FacturaItem[] = [];
        if (body.items) {
            try {
                processedItems = mergeItems(body.items, 'ERROR');
            } catch (error) {
                throw new DomainError(ErrorCodes.DUPLICATE_ITEM_COLOR_IN_PAYLOAD, (error as Error).message, 400);
            }
        }

        await this.validateCatalogSelections(body.proveedor, processedItems);

        try {
            return await this.repository.createDraft({
                nroFactura: body.nroFactura,
                proveedor: body.proveedor,
                createdBy,
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

        return this.repository.runDraftTransaction(async (tx: Prisma.TransactionClient) => {
            const currentFactura = await tx.factura.findUnique({ where: { id } });
            if (!currentFactura) {
                throw new DomainError(ErrorCodes.NOT_FOUND, 'Factura not found', 404);
            }

            if (currentFactura.estado === FacturaEstado.FINAL) {
                throw new DomainError(ErrorCodes.INVOICE_FINAL_READ_ONLY, 'Cannot edit finalized invoice', 409);
            }

            const currentUpdated = new Date(currentFactura.updatedAt).toISOString();
            const expected = new Date(body.expectedUpdatedAt).toISOString();
            if (currentUpdated !== expected) {
                throw new DomainError(
                    ErrorCodes.OPTIMISTIC_LOCK_CONFLICT,
                    'Conflict: Data has changed since last retrieval',
                    409
                );
            }

            await this.validateCatalogSelections(body.proveedor ?? currentFactura.proveedor ?? undefined, processedItems);

            await tx.factura.update({ where: { id }, data: { proveedor: body.proveedor } });

            if (body.items) {
                await this.repository.syncDraftItems(tx, id, processedItems);
            }

            return tx.factura.findUnique({ where: { id }, include: { items: { include: { colores: true } } } });
        });
    }

    async finalizeFactura(id: string, expectedUpdatedAt: string) {
        const factura = await this.repository.findById(id);
        if (!factura) {
            throw new DomainError(ErrorCodes.NOT_FOUND, 'Factura not found', 404);
        }

        if (factura.estado === FacturaEstado.FINAL) {
            throw new DomainError(ErrorCodes.INVOICE_ALREADY_FINALIZED, 'Invoice already finalized', 400);
        }

        const integrityError = validateFacturaIntegrity(factura);
        if (integrityError) {
            throw new DomainError(
                ErrorCodes.INVOICE_FINALIZE_INVALID,
                'Invoice integrity validation failed before finalization',
                422,
                {
                    reason: integrityError,
                    invoiceId: id,
                    state: factura.estado,
                    itemCount: factura.items?.length || 0
                }
            );
        }

        const finalized = await this.repository.updateToFinal(id, expectedUpdatedAt);
        if (!finalized) {
            throw new DomainError(ErrorCodes.OPTIMISTIC_LOCK_CONFLICT, 'Conflict: Data has changed since last retrieval', 409);
        }

        return finalized;
    }
}
