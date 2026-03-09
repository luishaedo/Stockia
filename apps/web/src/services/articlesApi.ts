import { ErrorCodes } from '@stockia/shared';
import { ApiError, HttpClient } from './httpClient';

type ArticleCatalogRef = {
    id: string;
    code: string;
    label: string;
};

export type ArticleResponse = {
    id: string;
    sku: string;
    description: string;
    supplierId: string;
    familyId: string;
    materialId: string;
    categoryId: string;
    classificationId: string;
    garmentTypeId: string;
    sizeCurveId: string;
    baseArticleId: string | null;
    createdAt: string;
    updatedAt: string;
    supplier: ArticleCatalogRef;
    sizeCurve: ArticleCatalogRef & { values: string[] };
};

export type CreateArticlePayload = {
    sku: string;
    description: string;
    supplierId: string;
    familyId: string;
    materialId: string;
    categoryId: string;
    classificationId: string;
    garmentTypeId: string;
    sizeCurveId: string;
};

export type CloneArticlePayload = Partial<Omit<CreateArticlePayload, 'sku' | 'description'>> & {
    sku: string;
    description: string;
};

export class ArticlesApiService {
    constructor(private readonly client: HttpClient) {}

    private buildApiUrl(path: string, forceApiPrefix = false) {
        const baseUrl = this.client.getBaseURL().replace(/\/$/, '');
        if (forceApiPrefix && !baseUrl.endsWith('/api')) {
            return `${baseUrl}/api${path}`;
        }
        return `${baseUrl}${path}`;
    }

    private async fetchWithApiPrefixFallback(path: string, init?: RequestInit) {
        const primaryResponse = await fetch(this.buildApiUrl(path), init);

        const contentType = primaryResponse.headers.get('content-type')?.toLowerCase() ?? '';
        const isJsonResponse = contentType.includes('application/json');
        const shouldRetryWithApiPrefix =
            primaryResponse.status === 404 || (primaryResponse.status === 400 && !isJsonResponse);

        if (!shouldRetryWithApiPrefix || this.client.getBaseURL().replace(/\/$/, '').endsWith('/api')) {
            return primaryResponse;
        }

        return fetch(this.buildApiUrl(path, true), init);
    }

    private async ensureArticlesRouteExists(response: Response, path: string): Promise<Response> {
        if (response.status !== 404) {
            return response;
        }

        const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
        const isJsonResponse = contentType.includes('application/json');

        if (isJsonResponse) {
            return response;
        }

        throw new ApiError(
            `Articles endpoints are not available in the deployed API (${path}). Verify backend deployment includes /articles routes.`,
            ErrorCodes.NOT_FOUND,
            404
        );
    }

    async searchArticles(params: { supplierId: string; q?: string; limit?: number }) {
        const query = new URLSearchParams();
        query.set('supplierId', params.supplierId);
        if (params.q?.trim()) query.set('q', params.q.trim());
        if (params.limit) query.set('limit', String(params.limit));

        const path = `/articles/search?${query.toString()}`;
        const response = await this.fetchWithApiPrefixFallback(path, {
            headers: this.client.getOptionalAccessTokenHeader()
        });

        const checkedResponse = await this.ensureArticlesRouteExists(response, '/articles/search');
        await this.client.assertOk(checkedResponse, 'No pudimos buscar artículos');
        return checkedResponse.json() as Promise<{ items: ArticleResponse[] }>;
    }

    async createArticle(payload: CreateArticlePayload) {
        const path = '/articles';
        const response = await this.fetchWithApiPrefixFallback(path, {
            method: 'POST',
            headers: {
                ...(await this.client.getAuthHeaders())
            },
            body: JSON.stringify(payload)
        });

        const checkedResponse = await this.ensureArticlesRouteExists(response, '/articles');
        await this.client.assertOk(checkedResponse, 'No pudimos crear el artículo');
        return checkedResponse.json() as Promise<ArticleResponse>;
    }

    async cloneArticle(articleId: string, payload: CloneArticlePayload) {
        const path = `/articles/${articleId}/clone`;
        const response = await this.fetchWithApiPrefixFallback(path, {
            method: 'POST',
            headers: {
                ...(await this.client.getAuthHeaders())
            },
            body: JSON.stringify(payload)
        });

        const checkedResponse = await this.ensureArticlesRouteExists(response, `/articles/${articleId}/clone`);
        await this.client.assertOk(checkedResponse, 'No pudimos clonar el artículo');
        return checkedResponse.json() as Promise<ArticleResponse>;
    }
}
