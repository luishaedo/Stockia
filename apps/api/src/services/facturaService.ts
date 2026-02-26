import { Prisma } from '@prisma/client';
import {
    AdminInvoiceListResponse,
    AdminInvoiceUserQuery,
    AdminInvoiceUsersResponse,
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
import { logger } from '../lib/logger.js';
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

const getSupplierIdFromSnapshot = (snapshot: Prisma.JsonValue | null): string | undefined => {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return undefined;
    const id = (snapshot as Record<string, unknown>).id;
    return typeof id === 'string' && id.trim() ? id : undefined;
};


const normalizeItemSupplierLabel = <T extends { supplierLabel?: string | null; marca?: string | null }>(item: T) => ({
    ...item,
    supplierLabel: item.supplierLabel?.trim() || item.marca?.trim() || '',
    marca: item.marca?.trim() || item.supplierLabel?.trim() || ''
});

const normalizeFacturaItems = <T extends { items?: Array<{ supplierLabel?: string | null; marca?: string | null }> | null }>(factura: T) => ({
    ...factura,
    items: (factura.items || []).map((item) => normalizeItemSupplierLabel(item))
});

type CatalogValidationResult = {
    normalizedSupplier: string;
    supplierSnapshot: {
        id: string;
        code: string;
        label: string;
    };
    normalizedItems: FacturaItem[];
    usedLegacySupplierField: boolean;
    usedLegacySizeCurveField: boolean;
};

export class FacturaService {
    constructor(private readonly repository: FacturaRepository) {}

    async listFacturas(filters: FacturaFilters): Promise<FacturaListResponse> {
        const { total, facturas } = await this.repository.list(filters);
        return {
            items: facturas.map((factura) => normalizeFacturaItems(factura)) as any as Factura[],
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
                createdBy: invoice.createdByUser
                    ? {
                        id: invoice.createdByUser.id,
                        name: invoice.createdByUser.name,
                        email: invoice.createdByUser.email
                    }
                    : null
            })),
            pagination: {
                page: filters.page,
                pageSize: filters.pageSize,
                total,
                totalPages: Math.ceil(total / filters.pageSize)
            }
        };
    }

    async listAdminInvoiceUsers(filters: AdminInvoiceUserQuery): Promise<AdminInvoiceUsersResponse> {
        const [total, users] = await this.repository.listAdminInvoiceUsers(filters);
        return {
            items: users,
            pagination: {
                page: filters.page,
                pageSize: filters.pageSize,
                total,
                totalPages: Math.ceil(total / filters.pageSize)
            }
        };
    }

    async getFacturaById(id: string) {
        const factura = await this.repository.findById(id);
        if (!factura) {
            throw new DomainError(ErrorCodes.NOT_FOUND, 'Factura not found', 404);
        }
        return normalizeFacturaItems(factura);
    }

    private async validateCatalogSelections(payload: { supplierId?: string; proveedor?: string }, items: FacturaItem[]): Promise<CatalogValidationResult> {
        const supplierId = payload.supplierId?.trim() || payload.proveedor?.trim();
        const usedLegacySupplierField = !payload.supplierId?.trim() && Boolean(payload.proveedor?.trim());

        if (!supplierId) {
            throw new DomainError(
                ErrorCodes.VALIDATION_FAILED,
                'Supplier is required. Select an existing supplier or create one first.',
                422
            );
        }

        const supplier = await this.repository.findSupplierById(supplierId);
        if (!supplier) {
            throw new DomainError(
                ErrorCodes.VALIDATION_FAILED,
                'Invalid supplier. Select an existing supplier or create one first.',
                422
            );
        }

        const supplierSnapshot = {
            id: supplier.id,
            code: supplier.code,
            label: supplier.name
        };

        if (items.length === 0) {
            return {
                normalizedSupplier: supplier.name,
                supplierSnapshot,
                normalizedItems: items,
                usedLegacySupplierField,
                usedLegacySizeCurveField: false
            };
        }

        let usedLegacySizeCurveField = false;

        const requiresLegacyCurveLookup = items.some(item => !item.sizeCurveId?.trim());
        const curves = requiresLegacyCurveLookup ? await this.repository.findAllSizeCurves() : [];

        const normalizedItems = await Promise.all(items.map(async (item) => {
            const sizeCurveId = item.sizeCurveId?.trim();
            if (sizeCurveId) {
                const sizeCurve = await this.repository.findSizeCurveById(sizeCurveId);
                if (!sizeCurve) {
                    throw new DomainError(
                        ErrorCodes.VALIDATION_FAILED,
                        `Invalid size curve for item ${item.codigoArticulo}. Select an existing size table.`,
                        422
                    );
                }

                const curveValues = normalizedValues(sizeCurve.values.map(value => value.value));

                return {
                    ...item,
                    marca: item.supplierLabel ?? item.marca,
                    sizeCurveId,
                    curvaTalles: curveValues,
                    sizeCurveSnapshot: {
                        id: sizeCurve.id,
                        code: sizeCurve.code,
                        label: sizeCurve.description,
                        values: curveValues
                    }
                };
            }

            if (curves.length === 0) {
                throw new DomainError(
                    ErrorCodes.VALIDATION_FAILED,
                    'No size tables available. Create a size table first.',
                    422
                );
            }

            const inputCurveValues = normalizedValues(item.curvaTalles);
            const matchingCurve = curves.find(curve => {
                const catalogValues = curve.values.map(value => value.value);
                return hasExactValues(catalogValues, inputCurveValues);
            });

            if (!matchingCurve) {
                throw new DomainError(
                    ErrorCodes.VALIDATION_FAILED,
                    `Invalid size curve for item ${item.codigoArticulo}. Select an existing size table.`,
                    422
                );
            }

            usedLegacySizeCurveField = true;

            return {
                ...item,
                marca: item.supplierLabel ?? item.marca,
                curvaTalles: inputCurveValues,
                sizeCurveId: matchingCurve.id,
                sizeCurveSnapshot: {
                    id: matchingCurve.id,
                    code: matchingCurve.code,
                    label: matchingCurve.description,
                    values: inputCurveValues
                }
            };
        }));

        return {
            normalizedSupplier: supplier.name,
            supplierSnapshot,
            normalizedItems,
            usedLegacySupplierField,
            usedLegacySizeCurveField
        };
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

        const catalogSelections = await this.validateCatalogSelections({ supplierId: body.supplierId, proveedor: body.proveedor }, processedItems);

        if (catalogSelections.usedLegacySupplierField) {
            logger.warn({ route: 'createFacturaDraft', field: 'proveedor' }, 'Deprecation warning: use supplierId instead of proveedor.');
        }
        if (catalogSelections.usedLegacySizeCurveField) {
            logger.warn({ route: 'createFacturaDraft', field: 'curvaTalles' }, 'Deprecation warning: use sizeCurveId instead of curvaTalles.');
        }
        const normalizedCreatedBy = createdBy?.trim();
        const createdByUser = normalizedCreatedBy
            ? await this.repository.upsertInvoiceUserByExternalId(normalizedCreatedBy)
            : null;

        try {
            const draft = await this.repository.createDraft({
                nroFactura: body.nroFactura,
                proveedor: catalogSelections.normalizedSupplier,
                supplierSnapshot: catalogSelections.supplierSnapshot,
                createdByUserId: createdByUser?.id,
                items: catalogSelections.normalizedItems
            });

            return normalizeFacturaItems(draft);
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

            const catalogSelections = await this.validateCatalogSelections(
                {
                    supplierId: body.supplierId,
                    proveedor: body.proveedor ?? getSupplierIdFromSnapshot(currentFactura.supplierSnapshot as Prisma.JsonValue | null)
                },
                processedItems
            );

            if (catalogSelections.usedLegacySupplierField) {
                logger.warn({ route: 'updateFacturaDraft', field: 'proveedor' }, 'Deprecation warning: use supplierId instead of proveedor.');
            }
            if (catalogSelections.usedLegacySizeCurveField) {
                logger.warn({ route: 'updateFacturaDraft', field: 'curvaTalles' }, 'Deprecation warning: use sizeCurveId instead of curvaTalles.');
            }

            await tx.factura.update({
                where: { id },
                data: {
                    proveedor: catalogSelections.normalizedSupplier,
                    supplierSnapshot: catalogSelections.supplierSnapshot as Prisma.InputJsonValue
                }
            });

            if (body.items) {
                await this.repository.syncDraftItems(tx, id, catalogSelections.normalizedItems);
            }

            const updatedDraft = await tx.factura.findUnique({ where: { id }, include: { items: { include: { colores: true } } } });
            return updatedDraft ? normalizeFacturaItems(updatedDraft) : updatedDraft;
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

        return normalizeFacturaItems(finalized);
    }
}
