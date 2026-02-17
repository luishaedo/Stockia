import { Factura, CreateFacturaDTO, UpdateFacturaDraftDTO, FacturaFilters, FacturaListResponse } from '@stockia/shared';

const API_URL = 'http://localhost:3000';

class ApiService {
    private baseURL = API_URL;

    async getFactura(id: string): Promise<Factura> {
        const response = await fetch(`${this.baseURL}/facturas/${id}`);
        if (!response.ok) throw new Error('Failed to fetch factura');
        return response.json();
    }

    async createFactura(data: CreateFacturaDTO): Promise<Factura> {
        const response = await fetch(`${this.baseURL}/facturas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Create failed');
        }
        return response.json();
    }

    async updateFacturaDraft(id: string, data: UpdateFacturaDraftDTO, expectedUpdatedAt?: string): Promise<Factura> {
        const payload = { ...data, expectedUpdatedAt };
        const response = await fetch(`${this.baseURL}/facturas/${id}/draft`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Update failed');
        }
        return response.json();
    }

    async getFacturas(filters: FacturaFilters = {}): Promise<FacturaListResponse> {
        const params = new URLSearchParams();
        if (filters.nroFactura) params.append('nroFactura', filters.nroFactura);
        if (filters.proveedor) params.append('proveedor', filters.proveedor);
        if (filters.estado) params.append('estado', filters.estado);
        if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.append('dateTo', filters.dateTo);
        if (filters.page) params.append('page', filters.page.toString());
        if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());
        if (filters.sortBy) params.append('sortBy', filters.sortBy);
        if (filters.sortDir) params.append('sortDir', filters.sortDir);

        const response = await fetch(`${this.baseURL}/facturas?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch facturas');
        return response.json();
    }

    async finalizeFactura(id: string): Promise<Factura> {
        const response = await fetch(`${this.baseURL}/facturas/${id}/finalize`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Finalize failed');
        }
        return response.json();
    }
}

export const api = new ApiService();
