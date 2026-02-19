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
    // Explicitly define key as string and value as number
    cantidadesPorTalle: z.record(z.string(), z.number().min(0)).refine(
        (data) => {
            const values = Object.values(data);
            return values.some((qty) => qty > 0);
        },
        { message: "At least one size quantity must be > 0" }
    )
});

export const FacturaItemSchema = z.object({
    marca: z.string().min(1),
    tipoPrenda: z.string().min(1),
    codigoArticulo: z.string().min(1),
    curvaTalles: z.array(z.string().min(1)).min(1),
    colores: z.array(VarianteColorSchema)
}).refine(
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
    proveedor: z.string().optional(),
    items: z.array(FacturaItemSchema).optional().refine(
        (items) => {
            if (!items) return true;
            // Check for duplicates in payload
            const seen = new Set<string>();
            for (const item of items) {
                for (const color of item.colores) {
                    const key = `${item.marca}|${item.tipoPrenda}|${item.codigoArticulo}|${color.codigoColor}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                }
            }
            return true;
        },
        { message: "DUPLICATE_ITEM_COLOR_IN_PAYLOAD" }
    )
});

export const UpdateFacturaDraftSchema = z.object({
    proveedor: z.string().optional(),
    items: z.array(FacturaItemSchema).optional(),
    duplicateHandler: z.enum(['SUM', 'REPLACE', 'ERROR']).optional(),
    expectedUpdatedAt: z.string().datetime().optional()
});

export const FinalizeFacturaSchema = z.object({
    expectedUpdatedAt: z.string().datetime()
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

export interface Factura {
    id: string;
    nroFactura: string;
    proveedor?: string | null;
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
