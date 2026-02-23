import { ApiErrorResponse, ErrorCodes, Factura, CreateFacturaDTO, UpdateFacturaDraftDTO, FacturaFilters, FacturaListResponse } from '@stockia/shared';

const envApiUrl = import.meta.env.VITE_API_URL;
const isProduction = import.meta.env.PROD;
const apiURL = envApiUrl || 'http://localhost:4000';

if (isProduction && !envApiUrl) {
    throw new Error('Missing VITE_API_URL environment variable in production');
}

const ACCESS_TOKEN_KEY = 'stockia.accessToken';
const CATALOG_CACHE_TTL_MS = 60_000;

export type AdminCatalogKey = 'suppliers' | 'size-curves' | 'families' | 'categories' | 'garment-types' | 'materials' | 'classifications';

export class ApiError extends Error {
    code: string;
    status: number;
    details?: unknown;
    traceId?: string;

    constructor(message: string, code: string, status: number, details?: unknown, traceId?: string) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.status = status;
        this.details = details;
        this.traceId = traceId;
    }
}

const getDefaultMessage = (status: number, fallback: string) => {
    if (status >= 500) return 'Error interno del servidor';
    return fallback;
};

const parseErrorPayload = async (response: Response, fallback: string): Promise<ApiError> => {
    let payload: ApiErrorResponse | { error?: string; code?: string; details?: unknown } | null = null;

    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (payload && typeof payload.error === 'object' && payload.error !== null && 'message' in payload.error) {
        return new ApiError(
            payload.error.message,
            payload.error.code || ErrorCodes.BAD_REQUEST,
            response.status,
            payload.error.details,
            payload.error.traceId
        );
    }

    if (payload && typeof payload.error === 'string') {
        const legacyPayload = payload as { error: string; code?: string; details?: unknown };
        return new ApiError(
            legacyPayload.error,
            legacyPayload.code || ErrorCodes.BAD_REQUEST,
            response.status,
            legacyPayload.details
        );
    }

    return new ApiError(getDefaultMessage(response.status, fallback), ErrorCodes.BAD_REQUEST, response.status);
};

const getStoredAccessToken = () => window.sessionStorage.getItem(ACCESS_TOKEN_KEY);

const emitAuthChanged = () => window.dispatchEvent(new Event('stockia-auth-changed'));

export const authTokenStore = {
    get() {
        return getStoredAccessToken();
    },
    set(token: string) {
        window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
        emitAuthChanged();
    },
    clear() {
        window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
        emitAuthChanged();
    }
};

class ApiService {
    private baseURL = apiURL;
    private catalogCache = new Map<AdminCatalogKey, { expiresAt: number; data: unknown }>();

    private getAccessTokenOrThrow() {
        const accessToken = getStoredAccessToken();
        if (!accessToken) {
            throw new ApiError('Se requiere autenticación', ErrorCodes.AUTH_TOKEN_MISSING, 401);
        }
        return accessToken;
    }

    private async getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            authorization: `Bearer ${this.getAccessTokenOrThrow()}`
        };
    }

    private async assertOk(response: Response, fallback: string) {
        if (response.ok) return;

        const parsed = await parseErrorPayload(response, fallback);

        console.error('API request failed', {
            url: response.url,
            status: response.status,
            code: parsed.code,
            message: parsed.message,
            details: parsed.details,
            traceId: parsed.traceId
        });

        if (parsed.code === ErrorCodes.AUTH_TOKEN_INVALID || parsed.code === ErrorCodes.AUTH_TOKEN_MISSING) {
            authTokenStore.clear();
        }
        throw parsed;
    }

    async login(username: string, password: string): Promise<string> {
        const response = await fetch(`${this.baseURL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        await this.assertOk(response, 'No pudimos iniciar sesión');
        const data = await response.json() as { accessToken: string };
        authTokenStore.set(data.accessToken);
        return data.accessToken;
    }

    async getFactura(id: string): Promise<Factura> {
        const response = await fetch(`${this.baseURL}/facturas/${id}`, {
            headers: { authorization: `Bearer ${this.getAccessTokenOrThrow()}` }
        });
        await this.assertOk(response, 'No pudimos obtener la factura');
        return response.json();
    }

    async createFactura(data: CreateFacturaDTO): Promise<Factura> {
        const response = await fetch(`${this.baseURL}/facturas`, {
            method: 'POST',
            headers: await this.getAuthHeaders(),
            body: JSON.stringify(data)
        });
        await this.assertOk(response, 'No pudimos crear la factura');
        return response.json();
    }

    async updateFacturaDraft(id: string, data: UpdateFacturaDraftDTO): Promise<Factura> {
        const response = await fetch(`${this.baseURL}/facturas/${id}/draft`, {
            method: 'PATCH',
            headers: await this.getAuthHeaders(),
            body: JSON.stringify(data)
        });
        await this.assertOk(response, 'No pudimos guardar los cambios');
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

        const response = await fetch(`${this.baseURL}/facturas?${params.toString()}`, {
            headers: { authorization: `Bearer ${this.getAccessTokenOrThrow()}` }
        });
        await this.assertOk(response, 'No pudimos cargar las facturas');
        return response.json();
    }

    async finalizeFactura(id: string, expectedUpdatedAt: string): Promise<Factura> {
        const response = await fetch(`${this.baseURL}/facturas/${id}/finalize`, {
            method: 'PATCH',
            headers: await this.getAuthHeaders(),
            body: JSON.stringify({ expectedUpdatedAt })
        });
        await this.assertOk(response, 'No pudimos finalizar la factura');
        return response.json();
    }

    async getAdminCatalog<T>(catalog: AdminCatalogKey): Promise<T> {
        const response = await fetch(`${this.baseURL}/admin/catalogs/${catalog}`, {
            headers: { authorization: `Bearer ${this.getAccessTokenOrThrow()}` }
        });
        await this.assertOk(response, 'No pudimos cargar el catálogo');
        return response.json();
    }

    async getAdminCatalogCached<T>(catalog: AdminCatalogKey, forceRefresh = false): Promise<T> {
        const cached = this.catalogCache.get(catalog);
        const now = Date.now();

        if (!forceRefresh && cached && cached.expiresAt > now) {
            return cached.data as T;
        }

        const data = await this.getAdminCatalog<T>(catalog);
        this.catalogCache.set(catalog, { data, expiresAt: now + CATALOG_CACHE_TTL_MS });
        return data;
    }

    invalidateCatalogCache(catalog?: AdminCatalogKey) {
        if (!catalog) {
            this.catalogCache.clear();
            return;
        }
        this.catalogCache.delete(catalog);
    }

    async createAdminCatalog(catalog: AdminCatalogKey, payload: Record<string, unknown>) {
        const response = await fetch(`${this.baseURL}/admin/catalogs/${catalog}`, {
            method: 'POST',
            headers: await this.getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        await this.assertOk(response, 'No pudimos crear el registro');
        this.invalidateCatalogCache(catalog);
        return response.json();
    }

    async updateAdminCatalog(catalog: AdminCatalogKey, id: string, payload: Record<string, unknown>) {
        const response = await fetch(`${this.baseURL}/admin/catalogs/${catalog}/${id}`, {
            method: 'PUT',
            headers: await this.getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        await this.assertOk(response, 'No pudimos actualizar el registro');
        this.invalidateCatalogCache(catalog);
        return response.json();
    }

    async deleteAdminCatalog(catalog: AdminCatalogKey, id: string): Promise<void> {
        const response = await fetch(`${this.baseURL}/admin/catalogs/${catalog}/${id}`, {
            method: 'DELETE',
            headers: { authorization: `Bearer ${this.getAccessTokenOrThrow()}` }
        });
        await this.assertOk(response, 'No pudimos eliminar el registro');
        this.invalidateCatalogCache(catalog);
    }

    async uploadAdminLogo(file: File): Promise<{ url: string }> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseURL}/admin/uploads/logo`, {
            method: 'POST',
            headers: {
                authorization: `Bearer ${this.getAccessTokenOrThrow()}`
            },
            body: formData
        });
        await this.assertOk(response, 'No pudimos subir el logo');
        return response.json();
    }

    resolveAssetUrl(url?: string | null): string {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `${this.baseURL}${url.startsWith('/') ? '' : '/'}${url}`;
    }
}

export const api = new ApiService();
