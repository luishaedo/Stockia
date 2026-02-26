import { z } from 'zod';

// Basic entities
export enum FacturaEstado {
    DRAFT = 'DRAFT',
    FINAL = 'FINAL'
}

export type DuplicateHandler = 'SUM' | 'REPLACE' | 'ERROR';

// Zod Schemas
export const VarianteColorSchema = z.object({
    codigoColor: z.string().min(1),
    nombreColor: z.string().min(1),
    // Allow partial size quantities. Missing sizes in the curve are treated as 0.
    cantidadesPorTalle: z.record(z.string(), z.number().min(0))
});

export const FacturaItemSchema = z.object({
    supplierLabel: z.string().min(1).optional(),
    marca: z.string().min(1).optional(),
    tipoPrenda: z.string().min(1),
    codigoArticulo: z.string().min(1),
    sizeCurveId: z.string().min(1).optional(),
    curvaTalles: z.array(z.string().min(1)).min(1),
    garmentTypeSnapshot: z.object({
        id: z.string().min(1),
        code: z.string().min(1),
        label: z.string().min(1)
    }).optional(),
    sizeCurveSnapshot: z.object({
        id: z.string().min(1),
        code: z.string().min(1),
        label: z.string().min(1),
        values: z.array(z.string().min(1)).min(1)
    }).optional(),
    colores: z.array(VarianteColorSchema)
}).refine(
    (item) => Boolean(item.supplierLabel?.trim()) || Boolean(item.marca?.trim()),
    { message: 'supplierLabel or marca must be provided', path: ['supplierLabel'] }
).refine(
    (item) => Boolean(item.sizeCurveId?.trim()) || item.curvaTalles.length > 0,
    { message: 'sizeCurveId or curvaTalles must be provided', path: ['sizeCurveId'] }
).refine(
    (item) => {
        // Validate quantities align with curva
        for (const color of item.colores) {
            const sizes = Object.keys(color.cantidadesPorTalle);
            for (const size of sizes) {
                if (!item.curvaTalles.includes(size)) {
                    return false; // Unknown size
                }
            }
        }
        return true;
    },
    { message: "cantidadesPorTalle keys must be present in curvaTalles" }
);


export const CreateFacturaSchema = z.object({
    nroFactura: z.string().min(1),
    supplierId: z.string().min(1).optional(),
    proveedor: z.string().optional(),
    supplierSnapshot: z.object({
        id: z.string().min(1),
        code: z.string().min(1),
        label: z.string().min(1)
    }).optional(),
    items: z.array(FacturaItemSchema).optional().refine(
        (items) => {
            if (!items) return true;
            // Check for duplicates in payload
            const seen = new Set<string>();
            for (const item of items) {
                for (const color of item.colores) {
                    const supplierLabel = item.supplierLabel?.trim() || item.marca?.trim() || '';
                    const key = `${supplierLabel}|${item.tipoPrenda}|${item.codigoArticulo}|${color.codigoColor}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                }
            }
            return true;
        },
        { message: "DUPLICATE_ITEM_COLOR_IN_PAYLOAD" }
    )
}).refine(
    (data) => Boolean(data.supplierId?.trim()) || Boolean(data.proveedor?.trim()),
    { message: 'supplierId or proveedor must be provided', path: ['supplierId'] }
);

export const UpdateFacturaDraftSchema = z.object({
    supplierId: z.string().min(1).optional(),
    proveedor: z.string().optional(),
    items: z.array(FacturaItemSchema).optional(),
    duplicateHandler: z.enum(['SUM', 'REPLACE', 'ERROR']).optional(),
    expectedUpdatedAt: z.string().datetime()
}).refine(
    (data) => data.supplierId === undefined || Boolean(data.supplierId.trim()),
    { message: 'supplierId cannot be empty', path: ['supplierId'] }
);

export const FinalizeFacturaSchema = z.object({
    expectedUpdatedAt: z.string().datetime()
});



export const OperationCatalogEntrySchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1)
});

export const OperationCatalogsResponseSchema = z.object({
    families: z.array(OperationCatalogEntrySchema),
    suppliers: z.array(OperationCatalogEntrySchema),
    colors: z.array(OperationCatalogEntrySchema),
    curves: z.array(OperationCatalogEntrySchema)
});

export const AdminInvoicesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    userId: z.string().min(1).optional()
}).refine(
    (data) => {
        if (!data.from || !data.to) return true;
        return new Date(data.from).getTime() <= new Date(data.to).getTime();
    },
    {
        message: 'from must be before or equal to to',
        path: ['from']
    }
);

export const AdminInvoiceUserQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().min(1).optional()
});

export const AdminInvoiceUserSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email().nullable(),
    externalId: z.string().min(1)
});

export const AdminInvoiceUsersResponseSchema = z.object({
    items: z.array(AdminInvoiceUserSchema),
    pagination: z.object({
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1).max(100),
        total: z.number().int().min(0),
        totalPages: z.number().int().min(0)
    })
});

export const AdminInvoiceSchema = z.object({
    id: z.string().min(1),
    number: z.string().min(1),
    supplier: z.string().nullable(),
    status: z.string().min(1),
    createdAt: z.union([z.string().datetime(), z.date()]),
    createdBy: z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        email: z.string().email().nullable()
    }).nullable()
});

export const AdminInvoiceListResponseSchema = z.object({
    items: z.array(AdminInvoiceSchema),
    pagination: z.object({
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1).max(100),
        total: z.number().int().min(0),
        totalPages: z.number().int().min(0)
    })
});

export const FacturaListQuerySchema = z.object({
    nroFactura: z.string().min(1).optional(),
    proveedor: z.string().min(1).optional(),
    estado: z.nativeEnum(FacturaEstado).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    sortBy: z.enum(['fecha', 'nroFactura', 'proveedor', 'estado']).default('fecha'),
    sortDir: z.enum(['asc', 'desc']).default('desc')
}).refine(
    (data) => {
        if (!data.dateFrom || !data.dateTo) return true;
        return new Date(data.dateFrom).getTime() <= new Date(data.dateTo).getTime();
    },
    {
        message: 'dateFrom must be before or equal to dateTo',
        path: ['dateFrom']
    }
);

// Derived Types
export type VarianteColor = z.infer<typeof VarianteColorSchema>;
export type FacturaItem = z.infer<typeof FacturaItemSchema>;
export type CreateFacturaDTO = z.infer<typeof CreateFacturaSchema>;
export type UpdateFacturaDraftDTO = z.infer<typeof UpdateFacturaDraftSchema>;
export type FinalizeFacturaDTO = z.infer<typeof FinalizeFacturaSchema>;
export type FacturaListQuery = z.infer<typeof FacturaListQuerySchema>;
export type AdminInvoicesQuery = z.infer<typeof AdminInvoicesQuerySchema>;
export type AdminInvoiceUserQuery = z.infer<typeof AdminInvoiceUserQuerySchema>;
export type AdminInvoice = z.infer<typeof AdminInvoiceSchema>;
export type AdminInvoiceListResponse = z.infer<typeof AdminInvoiceListResponseSchema>;
export type AdminInvoiceUser = z.infer<typeof AdminInvoiceUserSchema>;
export type AdminInvoiceUsersResponse = z.infer<typeof AdminInvoiceUsersResponseSchema>;
export type OperationCatalogEntry = z.infer<typeof OperationCatalogEntrySchema>;
export type OperationCatalogsResponse = z.infer<typeof OperationCatalogsResponseSchema>;

export interface Factura {
    id: string;
    nroFactura: string;
    proveedor?: string | null;
    supplierSnapshot?: {
        id: string;
        code: string;
        label: string;
    } | null;
    createdBy?: string | null;
    fecha: Date | string;
    estado: FacturaEstado;
    createdAt: Date | string;
    updatedAt: Date | string;
    items: FacturaItem[];
}

// Phase 3: List Filters & Pagination
export interface FacturaFilters {
    nroFactura?: string;
    proveedor?: string;
    estado?: FacturaEstado;
    dateFrom?: string; // ISO string
    dateTo?: string; // ISO string
    page?: number;
    pageSize?: number;
    sortBy?: 'fecha' | 'nroFactura' | 'proveedor' | 'estado';
    sortDir?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
    items: T[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export type FacturaListResponse = PaginatedResponse<Factura>;

// Error Codes
export const ErrorCodes = {
    DUPLICATE_ITEM_COLOR_IN_PAYLOAD: 'DUPLICATE_ITEM_COLOR_IN_PAYLOAD',
    INVOICE_FINAL_READ_ONLY: 'INVOICE_FINAL_READ_ONLY',
    INVOICE_FINALIZE_INVALID: 'INVOICE_FINALIZE_INVALID',
    OPTIMISTIC_LOCK_CONFLICT: 'OPTIMISTIC_LOCK_CONFLICT',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
    AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
    BAD_REQUEST: 'BAD_REQUEST',
    UNIQUE_CONSTRAINT_VIOLATION: 'UNIQUE_CONSTRAINT_VIOLATION',
    INVOICE_ALREADY_FINALIZED: 'INVOICE_ALREADY_FINALIZED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ApiErrorBody {
    code: ErrorCode | string;
    message: string;
    details?: unknown;
    traceId?: string;
}

export interface ApiErrorResponse {
    error: ApiErrorBody;
}
