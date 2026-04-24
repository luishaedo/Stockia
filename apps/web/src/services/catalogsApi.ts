import { OperationCatalogsResponse } from '@stockia/shared';
import { catalogCacheStore } from './catalogCacheStore';
import { HttpClient } from './httpClient';
import { AdminCatalogKey } from './types';

const DEFAULT_VERSION = 'W/"0"';
export type QuickCurveRecord = {
    id: string;
    sizeCurveId: string;
    code: string;
    label: string;
    values: Record<string, number>;
};

export type SupplierColorRecord = {
    id: string;
    supplierId: string;
    code: string;
    value: string;
    isDefault: boolean;
};

export class CatalogsApiService {
    constructor(private client: HttpClient) {}

    async preloadAdminCatalogsIncremental(catalogs: AdminCatalogKey[]) {
        for (const catalog of catalogs) {
            try {
                await this.getAdminCatalogCached(catalog);
            } catch {
                // Best-effort preload: do not interrupt user flow.
            }
        }
    }


    private async getCatalogVersion(catalog: AdminCatalogKey): Promise<string> {
        const path = `/admin/catalogs/${catalog}/version`;
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                headers: this.client.getOptionalAccessTokenHeader()
            });
            await this.client.assertOk(response, 'No pudimos validar versión de catálogo');
            const data = await response.json() as { version: string };
            return data.version;
        } catch (error) {
            return this.logAndThrowRequestError('getCatalogVersion', path, error);
        }
    }

    private async getOperationsVersion(): Promise<string> {
        const path = '/operations/catalogs/version';
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                headers: this.client.getOptionalAccessTokenHeader()
            });
            await this.client.assertOk(response, 'No pudimos validar versión de catálogos operativos');
            const data = await response.json() as { version: string };
            return data.version;
        } catch (error) {
            return this.logAndThrowRequestError('getOperationsVersion', path, error);
        }
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

        const path = '/operations/catalogs';
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                headers: this.client.getOptionalAccessTokenHeader()
            });
            await this.client.assertOk(response, 'No pudimos cargar los catálogos operativos');

            const data = await response.json() as OperationCatalogsResponse;
            const responseVersion = response.headers.get('ETag') ?? DEFAULT_VERSION;
            catalogCacheStore.setOperationsCatalogs(data, responseVersion);

            return data;
        } catch (error) {
            return this.logAndThrowRequestError('getOperationsCatalogs', path, error);
        }
    }

    async getAdminCatalog<T>(catalog: AdminCatalogKey): Promise<T> {
        const path = `/admin/catalogs/${catalog}`;
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                headers: this.client.getAccessTokenHeader()
            });
            await this.client.assertOk(response, 'No pudimos cargar el catálogo');
            return response.json();
        } catch (error) {
            return this.logAndThrowRequestError('getAdminCatalog', path, error);
        }
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

        const path = `/admin/catalogs/${catalog}`;
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                headers: this.client.getAccessTokenHeader()
            });
            await this.client.assertOk(response, 'No pudimos cargar el catálogo');
            const data = await response.json() as T;
            const responseVersion = response.headers.get('ETag') ?? DEFAULT_VERSION;

            catalogCacheStore.setAdminCatalog(catalog, data, responseVersion);
            return data;
        } catch (error) {
            return this.logAndThrowRequestError('getAdminCatalogCached', path, error);
        }
    }

    invalidateCatalogCache(catalog?: AdminCatalogKey) {
        catalogCacheStore.invalidateAdminCatalog(catalog);
        if (!catalog || catalog === 'suppliers' || catalog === 'families' || catalog === 'size-curves') {
            catalogCacheStore.invalidateOperationsCatalogs();
        }
    }


    async createSupplier(payload: { code: string; name: string; logoUrl?: string; logoPublicId?: string }) {
        const path = '/suppliers';
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                method: 'POST',
                headers: await this.client.getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            await this.client.assertOk(response, 'No pudimos crear el proveedor');
            this.invalidateCatalogCache('suppliers');
            return response.json() as Promise<{ id: string; code: string; name: string; logoUrl?: string | null }>;
        } catch (error) {
            return this.logAndThrowRequestError('createSupplier', path, error);
        }
    }

    async getSupplierColors(supplierId: string): Promise<SupplierColorRecord[]> {
        const path = `/suppliers/${encodeURIComponent(supplierId)}/colors`;
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                headers: this.client.getOptionalAccessTokenHeader()
            });
            await this.client.assertOk(response, 'No pudimos cargar colores del proveedor');
            const data = await response.json() as { items: SupplierColorRecord[] };
            return data.items;
        } catch (error) {
            return this.logAndThrowRequestError('getSupplierColors', path, error);
        }
    }

    async createSupplierColor(
        supplierId: string,
        payload: { code: string; value: string; isDefault?: boolean }
    ): Promise<SupplierColorRecord> {
        const path = `/suppliers/${encodeURIComponent(supplierId)}/colors`;
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                method: 'POST',
                headers: await this.client.getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            await this.client.assertOk(response, 'No pudimos crear color del proveedor');
            this.invalidateCatalogCache('suppliers');
            return response.json() as Promise<SupplierColorRecord>;
        } catch (error) {
            return this.logAndThrowRequestError('createSupplierColor', path, error);
        }
    }

    async updateSupplierColor(
        supplierId: string,
        colorId: string,
        payload: { code?: string; value?: string; isDefault?: boolean }
    ): Promise<SupplierColorRecord> {
        const path = `/suppliers/${encodeURIComponent(supplierId)}/colors/${encodeURIComponent(colorId)}`;
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                method: 'PATCH',
                headers: await this.client.getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            await this.client.assertOk(response, 'No pudimos actualizar color del proveedor');
            this.invalidateCatalogCache('suppliers');
            return response.json() as Promise<SupplierColorRecord>;
        } catch (error) {
            return this.logAndThrowRequestError('updateSupplierColor', path, error);
        }
    }

    async deleteSupplierColor(supplierId: string, colorId: string): Promise<void> {
        const path = `/suppliers/${encodeURIComponent(supplierId)}/colors/${encodeURIComponent(colorId)}`;
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                method: 'DELETE',
                headers: this.client.getAccessTokenHeader()
            });
            await this.client.assertOk(response, 'No pudimos eliminar color del proveedor');
            this.invalidateCatalogCache('suppliers');
        } catch (error) {
            return this.logAndThrowRequestError('deleteSupplierColor', path, error);
        }
    }

    async createAdminCatalog(catalog: AdminCatalogKey, payload: Record<string, unknown>) {
        const path = `/admin/catalogs/${catalog}`;
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                method: 'POST',
                headers: await this.client.getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            await this.client.assertOk(response, 'No pudimos crear el registro');
            this.invalidateCatalogCache(catalog);
            return response.json();
        } catch (error) {
            return this.logAndThrowRequestError('createAdminCatalog', path, error);
        }
    }

    async updateAdminCatalog(catalog: AdminCatalogKey, id: string, payload: Record<string, unknown>) {
        const path = `/admin/catalogs/${catalog}/${id}`;
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                method: 'PUT',
                headers: await this.client.getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            await this.client.assertOk(response, 'No pudimos actualizar el registro');
            this.invalidateCatalogCache(catalog);
            return response.json();
        } catch (error) {
            return this.logAndThrowRequestError('updateAdminCatalog', path, error);
        }
    }

    async deleteAdminCatalog(catalog: AdminCatalogKey, id: string): Promise<void> {
        const path = `/admin/catalogs/${catalog}/${id}`;
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                method: 'DELETE',
                headers: this.client.getAccessTokenHeader()
            });
            await this.client.assertOk(response, 'No pudimos eliminar el registro');
            this.invalidateCatalogCache(catalog);
        } catch (error) {
            return this.logAndThrowRequestError('deleteAdminCatalog', path, error);
        }
    }

    async getQuickCurves(sizeCurveId: string): Promise<QuickCurveRecord[]> {
        const path = `/admin/catalogs/quick-curves?sizeCurveId=${encodeURIComponent(sizeCurveId)}`;
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                headers: this.client.getAccessTokenHeader()
            });
            await this.client.assertOk(response, 'No pudimos cargar las curvas rápidas');
            return response.json() as Promise<QuickCurveRecord[]>;
        } catch (error) {
            return this.logAndThrowRequestError('getQuickCurves', path, error);
        }
    }

    async createQuickCurve(payload: Omit<QuickCurveRecord, 'id'>): Promise<QuickCurveRecord> {
        const path = '/admin/catalogs/quick-curves';
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                method: 'POST',
                headers: await this.client.getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            await this.client.assertOk(response, 'No pudimos crear la curva rápida');
            return response.json() as Promise<QuickCurveRecord>;
        } catch (error) {
            return this.logAndThrowRequestError('createQuickCurve', path, error);
        }
    }

    async updateQuickCurve(id: string, payload: Omit<QuickCurveRecord, 'id'>): Promise<QuickCurveRecord> {
        const path = `/admin/catalogs/quick-curves/${id}`;
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                method: 'PUT',
                headers: await this.client.getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            await this.client.assertOk(response, 'No pudimos actualizar la curva rápida');
            return response.json() as Promise<QuickCurveRecord>;
        } catch (error) {
            return this.logAndThrowRequestError('updateQuickCurve', path, error);
        }
    }

    async deleteQuickCurve(id: string): Promise<void> {
        const path = `/admin/catalogs/quick-curves/${id}`;
        try {
            const response = await fetch(`${this.client.getBaseURL()}${path}`, {
                method: 'DELETE',
                headers: this.client.getAccessTokenHeader()
            });
            await this.client.assertOk(response, 'No pudimos eliminar la curva rápida');
        } catch (error) {
            return this.logAndThrowRequestError('deleteQuickCurve', path, error);
        }
    }
    private async logAndThrowRequestError(context: string, path: string, error: unknown): Promise<never> {
        console.error('[CatalogsApiService] request failed', {
            context,
            path,
            baseUrl: this.client.getBaseURL(),
            error
        });
        throw error;
    }
}
