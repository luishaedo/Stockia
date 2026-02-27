import { OperationCatalogsResponse } from '@stockia/shared';
import { catalogCacheStore } from './catalogCacheStore';
import { HttpClient } from './httpClient';
import { AdminCatalogKey } from './types';

const DEFAULT_VERSION = 'W/"0"';

export class CatalogsApiService {
    constructor(private client: HttpClient) {}


    private async getCatalogVersion(catalog: AdminCatalogKey): Promise<string> {
        const response = await fetch(`${this.client.getBaseURL()}/admin/catalogs/${catalog}/version`, {
            headers: this.client.getAccessTokenHeader()
        });
        await this.client.assertOk(response, 'No pudimos validar versión de catálogo');
        const data = await response.json() as { version: string };
        return data.version;
    }

    private async getOperationsVersion(): Promise<string> {
        const response = await fetch(`${this.client.getBaseURL()}/operations/catalogs/version`, {
            headers: this.client.getAccessTokenHeader()
        });
        await this.client.assertOk(response, 'No pudimos validar versión de catálogos operativos');
        const data = await response.json() as { version: string };
        return data.version;
    }

    async getOperationsCatalogs(forceRefresh = false): Promise<OperationCatalogsResponse> {
        const cached = catalogCacheStore.getOperationsCatalogs();

        if (!forceRefresh && cached) {
            const serverVersion = await this.getOperationsVersion();
            if (serverVersion === cached.version) {
                return cached.data;
            }
            catalogCacheStore.invalidateOperationsCatalogs();
        }

        const response = await fetch(`${this.client.getBaseURL()}/operations/catalogs`, {
            headers: this.client.getAccessTokenHeader()
        });
        await this.client.assertOk(response, 'No pudimos cargar los catálogos operativos');

        const data = await response.json() as OperationCatalogsResponse;
        const responseVersion = response.headers.get('ETag') ?? DEFAULT_VERSION;
        catalogCacheStore.setOperationsCatalogs(data, responseVersion);

        return data;
    }

    async getAdminCatalog<T>(catalog: AdminCatalogKey): Promise<T> {
        const response = await fetch(`${this.client.getBaseURL()}/admin/catalogs/${catalog}`, {
            headers: this.client.getAccessTokenHeader()
        });
        await this.client.assertOk(response, 'No pudimos cargar el catálogo');
        return response.json();
    }

    async getAdminCatalogCached<T>(catalog: AdminCatalogKey, forceRefresh = false): Promise<T> {
        const cached = catalogCacheStore.getAdminCatalog<T>(catalog);

        if (!forceRefresh && cached) {
            const serverVersion = await this.getCatalogVersion(catalog);
            if (serverVersion === cached.version) {
                return cached.data;
            }
            catalogCacheStore.invalidateAdminCatalog(catalog);
        }

        const response = await fetch(`${this.client.getBaseURL()}/admin/catalogs/${catalog}`, {
            headers: this.client.getAccessTokenHeader()
        });
        await this.client.assertOk(response, 'No pudimos cargar el catálogo');
        const data = await response.json() as T;
        const responseVersion = response.headers.get('ETag') ?? DEFAULT_VERSION;

        catalogCacheStore.setAdminCatalog(catalog, data, responseVersion);
        return data;
    }

    invalidateCatalogCache(catalog?: AdminCatalogKey) {
        catalogCacheStore.invalidateAdminCatalog(catalog);
        if (!catalog || catalog === 'suppliers' || catalog === 'families' || catalog === 'size-curves') {
            catalogCacheStore.invalidateOperationsCatalogs();
        }
    }

    async createAdminCatalog(catalog: AdminCatalogKey, payload: Record<string, unknown>) {
        const response = await fetch(`${this.client.getBaseURL()}/admin/catalogs/${catalog}`, {
            method: 'POST',
            headers: await this.client.getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        await this.client.assertOk(response, 'No pudimos crear el registro');
        this.invalidateCatalogCache(catalog);
        return response.json();
    }

    async updateAdminCatalog(catalog: AdminCatalogKey, id: string, payload: Record<string, unknown>) {
        const response = await fetch(`${this.client.getBaseURL()}/admin/catalogs/${catalog}/${id}`, {
            method: 'PUT',
            headers: await this.client.getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        await this.client.assertOk(response, 'No pudimos actualizar el registro');
        this.invalidateCatalogCache(catalog);
        return response.json();
    }

    async deleteAdminCatalog(catalog: AdminCatalogKey, id: string): Promise<void> {
        const response = await fetch(`${this.client.getBaseURL()}/admin/catalogs/${catalog}/${id}`, {
            method: 'DELETE',
            headers: this.client.getAccessTokenHeader()
        });
        await this.client.assertOk(response, 'No pudimos eliminar el registro');
        this.invalidateCatalogCache(catalog);
    }
}
