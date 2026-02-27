import { CreateFacturaDTO, Factura, FacturaFilters, FacturaListResponse, UpdateFacturaDraftDTO } from '@stockia/shared';
import { HttpClient } from './httpClient';

export class FacturasApiService {
    constructor(private client: HttpClient) {}

    async getFactura(id: string): Promise<Factura> {
        const response = await fetch(`${this.client.getBaseURL()}/facturas/${id}`, {
            headers: this.client.getAccessTokenHeader()
        });
        await this.client.assertOk(response, 'No pudimos obtener la factura');
        return response.json();
    }

    async createFactura(data: CreateFacturaDTO): Promise<Factura> {
        const response = await fetch(`${this.client.getBaseURL()}/facturas`, {
            method: 'POST',
            headers: await this.client.getAuthHeaders(),
            body: JSON.stringify(data)
        });
        await this.client.assertOk(response, 'No pudimos crear la factura');
        return response.json();
    }

    async updateFacturaDraft(id: string, data: UpdateFacturaDraftDTO): Promise<Factura> {
        const response = await fetch(`${this.client.getBaseURL()}/facturas/${id}/draft`, {
            method: 'PATCH',
            headers: await this.client.getAuthHeaders(),
            body: JSON.stringify(data)
        });
        await this.client.assertOk(response, 'No pudimos guardar los cambios');
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

        const response = await fetch(`${this.client.getBaseURL()}/facturas?${params.toString()}`, {
            headers: this.client.getAccessTokenHeader()
        });
        await this.client.assertOk(response, 'No pudimos cargar las facturas');
        return response.json();
    }

    async finalizeFactura(id: string, expectedUpdatedAt: string): Promise<Factura> {
        const response = await fetch(`${this.client.getBaseURL()}/facturas/${id}/finalize`, {
            method: 'PATCH',
            headers: await this.client.getAuthHeaders(),
            body: JSON.stringify({ expectedUpdatedAt })
        });
        await this.client.assertOk(response, 'No pudimos finalizar la factura');
        return response.json();
    }
}
