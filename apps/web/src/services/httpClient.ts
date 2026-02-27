import { ApiErrorResponse, ErrorCodes } from '@stockia/shared';

const envApiUrl = import.meta.env.VITE_API_URL;
const isProduction = import.meta.env.PROD;

export const apiURL = envApiUrl || 'http://localhost:4000';

if (isProduction && !envApiUrl) {
    throw new Error('Missing VITE_API_URL environment variable in production');
}

const ACCESS_TOKEN_KEY = 'stockia.accessToken';

const getStoredAccessToken = () => window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
const emitAuthChanged = () => window.dispatchEvent(new Event('stockia-auth-changed'));

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

export class HttpClient {
    private baseURL = apiURL;

    private getAccessTokenOrThrow() {
        const accessToken = getStoredAccessToken();
        if (!accessToken) {
            throw new ApiError('Se requiere autenticación', ErrorCodes.AUTH_TOKEN_MISSING, 401);
        }
        return accessToken;
    }

    async getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            authorization: `Bearer ${this.getAccessTokenOrThrow()}`
        };
    }

    getAccessTokenHeader() {
        return { authorization: `Bearer ${this.getAccessTokenOrThrow()}` };
    }

    async assertOk(response: Response, fallback: string) {
        if (response.ok) return;

        const parsed = await parseErrorPayload(response, fallback);

        if (parsed.code === ErrorCodes.AUTH_TOKEN_INVALID || parsed.code === ErrorCodes.AUTH_TOKEN_MISSING) {
            authTokenStore.clear();
        }

        throw parsed;
    }

    getBaseURL() {
        return this.baseURL;
    }
}
