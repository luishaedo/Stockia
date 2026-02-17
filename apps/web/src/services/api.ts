import { Factura, CreateFacturaDTO, UpdateFacturaDraftDTO } from '@stockia/shared';

const API_URL = 'http://localhost:3000';

class ApiService {
    private async request<T>(method: string, path: string, body?: any): Promise<T> {
        const headers = { 'Content-Type': 'application/json' };
        const response = await fetch(`${API_URL}${path}`, {
            method,
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP Error ${response.status}`);
        }

        return response.json();
    }

    async getFactura(id: string): Promise<Factura> {
        return this.request<Factura>('GET', `/facturas/${id}`);
    }

    async createFactura(data: CreateFacturaDTO): Promise<Factura> {
        return this.request<Factura>('POST', '/facturas', data);
    }

    async updateFacturaDraft(id: string, data: UpdateFacturaDraftDTO, lastUpdatedAt?: string): Promise<Factura> {
        // Add expectedUpdatedAt if provided for optimistic locking
        const payload = { ...data, expectedUpdatedAt: lastUpdatedAt };
        return this.request<Factura>('PATCH', `/facturas/${id}/draft`, payload);
    }
}

export const api = new ApiService();
