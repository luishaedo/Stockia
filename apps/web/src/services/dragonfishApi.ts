import { HttpClient } from './httpClient';

export type DragonfishEquivalenceRow = {
    id: string | null;
    status: 'mapped' | 'pending';
    articleId: string;
    supplier: { id: string; code: string; label: string };
    article: { sku: string; description: string };
    colorCode: string;
    colorDescription: string;
    dragonfishCode: string | null;
    updatedAt: string | null;
};

export type DragonfishEquivalenceList = {
    items: DragonfishEquivalenceRow[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
};

export type MissingDragonfishEquivalence = {
    articleId: string | null;
    supplierCode: string;
    supplierLabel: string;
    articleSku: string;
    articleDescription: string;
    colorCode: string;
    colorDescription: string;
};

export type DragonfishImportPreviewRow = {
    rowNumber: number;
    supplierCode: string;
    articleSku: string;
    articleDescription: string;
    colorCode: string;
    colorDescription: string;
    dragonfishCode: string;
    warnings: string[];
    errors: string[];
    importable: boolean;
    action: 'create' | 'update' | 'unchanged';
};

export type DragonfishImportPreview = {
    previewId: string;
    result: {
        fileName: string;
        missingRequiredColumns: string[];
        rows: DragonfishImportPreviewRow[];
        summary: {
            totalRows: number;
            importableRows: number;
            errorRows: number;
            warningRows: number;
            createRows: number;
            updateRows: number;
            unchangedRows: number;
        };
    };
};

export class DragonfishApiService {
    constructor(private readonly client: HttpClient) {}

    async listEquivalences(params: {
        supplierId?: string;
        articleId?: string;
        q?: string;
        status?: 'all' | 'mapped' | 'pending';
        page?: number;
        pageSize?: number;
    } = {}) {
        const query = new URLSearchParams();
        if (params.supplierId) query.set('supplierId', params.supplierId);
        if (params.articleId) query.set('articleId', params.articleId);
        if (params.q) query.set('q', params.q);
        if (params.status) query.set('status', params.status);
        if (params.page) query.set('page', String(params.page));
        if (params.pageSize) query.set('pageSize', String(params.pageSize));
        const response = await fetch(`${this.client.getBaseURL()}/dragonfish-equivalences?${query}`, {
            headers: await this.client.getAuthHeaders()
        });
        await this.client.assertOk(response, 'No pudimos cargar las equivalencias Dragonfish');
        return response.json() as Promise<DragonfishEquivalenceList>;
    }

    async createEquivalence(payload: { articleId: string; colorCode?: string; dragonfishCode: string }) {
        const response = await fetch(`${this.client.getBaseURL()}/dragonfish-equivalences`, {
            method: 'POST',
            headers: await this.client.getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        await this.client.assertOk(response, 'No pudimos crear la equivalencia Dragonfish');
        return response.json();
    }

    async updateEquivalence(id: string, dragonfishCode: string) {
        const response = await fetch(`${this.client.getBaseURL()}/dragonfish-equivalences/${id}`, {
            method: 'PUT',
            headers: await this.client.getAuthHeaders(),
            body: JSON.stringify({ dragonfishCode })
        });
        await this.client.assertOk(response, 'No pudimos actualizar la equivalencia Dragonfish');
        return response.json();
    }

    async deleteEquivalence(id: string) {
        const response = await fetch(`${this.client.getBaseURL()}/dragonfish-equivalences/${id}`, {
            method: 'DELETE',
            headers: await this.client.getAuthHeaders()
        });
        await this.client.assertOk(response, 'No pudimos eliminar la equivalencia Dragonfish');
    }

    async downloadImportTemplate() {
        const response = await fetch(`${this.client.getBaseURL()}/dragonfish-equivalences/import/template`, {
            headers: await this.client.getAuthHeaders()
        });
        await this.client.assertOk(response, 'No pudimos descargar la plantilla');
        return response.blob();
    }

    async previewImport(file: File) {
        const authHeaders = await this.client.getAuthHeaders();
        const formData = new FormData();
        formData.set('file', file);
        const response = await fetch(`${this.client.getBaseURL()}/dragonfish-equivalences/import/preview`, {
            method: 'POST',
            headers: { authorization: authHeaders.authorization },
            body: formData
        });
        await this.client.assertOk(response, 'No pudimos previsualizar el archivo');
        return response.json() as Promise<DragonfishImportPreview>;
    }

    async commitImport(previewId: string, rowNumbers?: number[]) {
        const response = await fetch(`${this.client.getBaseURL()}/dragonfish-equivalences/import/commit`, {
            method: 'POST',
            headers: await this.client.getAuthHeaders(),
            body: JSON.stringify({ previewId, rowNumbers })
        });
        await this.client.assertOk(response, 'No pudimos importar las equivalencias');
        return response.json() as Promise<{
            summary: {
                requestedRows: number;
                createdRows: number;
                updatedRows: number;
                unchangedRows: number;
                rejectedRows: number;
            };
        }>;
    }

    async downloadInvoiceExport(invoiceId: string) {
        const response = await fetch(`${this.client.getBaseURL()}/facturas/${invoiceId}/dragonfish-export`, {
            headers: await this.client.getAuthHeaders()
        });
        await this.client.assertOk(response, 'No pudimos exportar la factura para Dragonfish');
        const disposition = response.headers.get('content-disposition') || '';
        const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || `factura-${invoiceId}.txt`;
        return { blob: await response.blob(), fileName };
    }
}
