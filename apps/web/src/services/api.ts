import { ApiErrorResponse, ErrorCodes, Factura, CreateFacturaDTO, UpdateFacturaDraftDTO, FacturaFilters, FacturaListResponse } from '@stockia/shared';

const envApiUrl = import.meta.env.VITE_API_URL;
const isProduction = import.meta.env.PROD;
const apiURL = envApiUrl || 'http://localhost:4000';

if (isProduction && !envApiUrl) {
    throw new Error('Missing VITE_API_URL environment variable in production');
}

const ACCESS_TOKEN_KEY = 'stockia.accessToken';

export class ApiError extends Error {
    code: string;
    status: number;
    details?: unknown;

    constructor(message: string, code: string, status: number, details?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}

const getDefaultMessage = (status: number, fallback: string) => {
    if (status >= 500) return 'Internal Server Error';
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
            payload.error.details
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

class ApiService {
    private baseURL = apiURL;

    private getAccessToken() {
        return window.localStorage.getItem(ACCESS_TOKEN_KEY);
    }

    private setAccessToken(token: string) {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    }

    private async loginWithPrompt() {
        const username = window.prompt('Enter API username');
        const password = window.prompt('Enter API password');

        if (!username || !password) {
            throw new ApiError('Authentication cancelled', ErrorCodes.UNAUTHORIZED, 401);
        }

        const response = await fetch(`${this.baseURL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        await this.assertOk(response, 'Login failed');
        const data = await response.json() as { accessToken: string };
        this.setAccessToken(data.accessToken);
        return data.accessToken;
    }

    private async getWriteHeaders() {
        let accessToken = this.getAccessToken();
        if (!accessToken) {
            accessToken = await this.loginWithPrompt();
        }

        return {
            'Content-Type': 'application/json',
            authorization: `Bearer ${accessToken}`
        };
    }

    private async assertOk(response: Response, fallback: string) {
        if (response.ok) return;
        throw await parseErrorPayload(response, fallback);
    }

    async getFactura(id: string): Promise<Factura> {
        const response = await fetch(`${this.baseURL}/facturas/${id}`);
        await this.assertOk(response, 'Failed to fetch factura');
        return response.json();
    }

    async createFactura(data: CreateFacturaDTO): Promise<Factura> {
        const response = await fetch(`${this.baseURL}/facturas`, {
            method: 'POST',
            headers: await this.getWriteHeaders(),
            body: JSON.stringify(data)
        });
        await this.assertOk(response, 'Create failed');
        return response.json();
    }

    async updateFacturaDraft(id: string, data: UpdateFacturaDraftDTO, expectedUpdatedAt?: string): Promise<Factura> {
        const payload = { ...data, expectedUpdatedAt };
        const response = await fetch(`${this.baseURL}/facturas/${id}/draft`, {
            method: 'PATCH',
            headers: await this.getWriteHeaders(),
            body: JSON.stringify(payload)
        });
        await this.assertOk(response, 'Update failed');
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
        await this.assertOk(response, 'Failed to fetch facturas');
        return response.json();
    }

    async finalizeFactura(id: string, expectedUpdatedAt: string): Promise<Factura> {
        const response = await fetch(`${this.baseURL}/facturas/${id}/finalize`, {
            method: 'PATCH',
            headers: await this.getWriteHeaders(),
            body: JSON.stringify({ expectedUpdatedAt })
        });
        await this.assertOk(response, 'Finalize failed');
        return response.json();
    }
}

export const api = new ApiService();
