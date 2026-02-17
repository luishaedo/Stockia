// Basic entities
export enum FacturaEstado {
    DRAFT = 'DRAFT',
    FINAL = 'FINAL'
}

export type DuplicateHandler = 'SUM' | 'REPLACE' | 'ERROR';

export interface VarianteColor {
    codigoColor: string;
    nombreColor: string;
    cantidadesPorTalle: Record<string, number>; // e.g. { "S": 2, "M": 3 }
}

export interface FacturaItem {
    marca: string;
    tipoPrenda: string;
    codigoArticulo: string;
    curvaTalles: string[]; // e.g. ["S", "M", "L", "XL"]
    colores: VarianteColor[];
}

export interface Factura {
    id?: string;
    nroFactura: string;
    proveedor?: string;
    fecha: Date | string;
    estado: FacturaEstado;
    createdAt: Date | string;
    updatedAt: Date | string;
    items: FacturaItem[];
}

// DTOs
export interface CreateFacturaDTO {
    nroFactura: string;
    proveedor?: string;
    items?: FacturaItem[];
}

export interface UpdateFacturaDraftDTO {
    proveedor?: string;
    items?: FacturaItem[];
    duplicateHandler?: DuplicateHandler;
}
