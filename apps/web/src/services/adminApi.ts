import { AdminInvoiceListResponse, AdminInvoicesQuery, AdminInvoiceUserQuery, AdminInvoiceUsersResponse } from '@stockia/shared';
import { HttpClient } from './httpClient';

export class AdminApiService {
    constructor(private client: HttpClient) {}

    async getAdminInvoices(filters: Partial<AdminInvoicesQuery> = {}): Promise<AdminInvoiceListResponse> {
        const params = new URLSearchParams();
        if (filters.page) params.append('page', filters.page.toString());
        if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());
        if (filters.from) params.append('from', filters.from);
        if (filters.to) params.append('to', filters.to);
        if (filters.userId) params.append('userId', filters.userId);

        const response = await fetch(`${this.client.getBaseURL()}/admin/invoices?${params.toString()}`, {
            headers: this.client.getAccessTokenHeader()
        });
        await this.client.assertOk(response, 'No pudimos cargar el panel de facturas admin');
        return response.json();
    }

    async getAdminInvoiceUsers(filters: Partial<AdminInvoiceUserQuery> = {}): Promise<AdminInvoiceUsersResponse> {
        const params = new URLSearchParams();
        if (filters.page) params.append('page', filters.page.toString());
        if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());
        if (filters.search) params.append('search', filters.search);

        const response = await fetch(`${this.client.getBaseURL()}/admin/invoice-users?${params.toString()}`, {
            headers: this.client.getAccessTokenHeader()
        });
        await this.client.assertOk(response, 'No pudimos cargar usuarios de facturas admin');
        return response.json();
    }

    async uploadAdminLogo(file: File): Promise<{ url: string }> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.client.getBaseURL()}/admin/uploads/logo`, {
            method: 'POST',
            headers: this.client.getAccessTokenHeader(),
            body: formData
        });
        await this.client.assertOk(response, 'No pudimos subir el logo');
        return response.json();
    }

    resolveAssetUrl(url?: string | null): string {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `${this.client.getBaseURL()}${url.startsWith('/') ? '' : '/'}${url}`;
    }
}
