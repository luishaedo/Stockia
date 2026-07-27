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
    familyId?: string;
    materialId?: string;
    categoryId?: string;
    classificationId?: string;
    garmentTypeId?: string;
    sizeCurveId: string;
};

export type CloneArticlePayload = Partial<Omit<CreateArticlePayload, 'sku' | 'description'>> & {
    sku: string;
    description: string;
};

export type UpdateArticlePayload = {
    description: string;
    supplierId: string;
    familyId: string;
    materialId: string;
    categoryId: string;
    classificationId: string;
    garmentTypeId: string;
    sizeCurveId: string;
};

type ArticleMutationResponse = {
    success: boolean;
    data: ArticleResponse;
};

type ArticleDeleteResponse = {
    success: boolean;
    data: { id: string };
};

export type ArticleImportPreviewRow = {
    rowNumber: number;
    normalized: Record<string, string | number | undefined>;
    resolutions: Record<string, { code: string; resolved: boolean; catalogId: string | null; warning?: string; error?: string }>;
    warnings: string[];
    errors: string[];
    importable: boolean;
    duplicateInFile: boolean;
    duplicateInDatabase: boolean;
};

export type ArticleImportPreviewResponse = {
    previewId: string | null;
    result: {
        fileName: string;
        rows: ArticleImportPreviewRow[];
        summary: {
            totalRows: number;
            importableRows: number;
            errorRows: number;
            warningRows: number;
            duplicateInFileRows: number;
            duplicateInDatabaseRows: number;
        };
        missingRequiredColumns: string[];
        fileWarnings: string[];
    };
};


export type ArticleImportBatchResponse = {
    previewId: string;
    successCount: number;
    failedCount: number;
    results: Array<{
        rowNumber: number;
        sku: string;
        status: 'created' | 'rejected';
        reason?: string;
    }>;
};

export type ArticleImportCommitResponse = {
    previewId: string;
    status?: 'committed' | 'replayed';
    summary: {
        requestedRows: number;
        attemptedRows: number;
        importedRows: number;
        skippedRows: number;
    };
    createdRows: number[];
    skippedRows: Array<{ rowNumber: number; reason: string }>;
};

export class ArticlesApiService {
    constructor(private readonly client: HttpClient) {}

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
        const response = await fetch(`${this.client.getBaseURL()}${path}`, {
            headers: this.client.getOptionalAccessTokenHeader()
        });

        const checkedResponse = await this.ensureArticlesRouteExists(response, '/articles/search');
        await this.client.assertOk(checkedResponse, 'No pudimos buscar artículos');
        return checkedResponse.json() as Promise<{ items: ArticleResponse[] }>;
    }

    async downloadArticlesExport(supplierId: string) {
        const query = new URLSearchParams({ supplierId });
        const path = `/articles/export?${query.toString()}`;
        const response = await fetch(`${this.client.getBaseURL()}${path}`, {
            headers: await this.client.getAuthHeaders()
        });

        const checkedResponse = await this.ensureArticlesRouteExists(response, '/articles/export');
        await this.client.assertOk(checkedResponse, 'No pudimos exportar los artículos');
        const disposition = checkedResponse.headers.get('content-disposition') || '';
        const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || 'articulos.csv';
        return { blob: await checkedResponse.blob(), fileName };
    }

    async createArticle(payload: CreateArticlePayload) {
        const path = '/articles';
        const response = await fetch(`${this.client.getBaseURL()}${path}`, {
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


    async previewArticleImport(file: File) {
        const path = '/admin/articles/import/preview';
        const formData = new FormData();
        formData.set('file', file);

        const response = await fetch(`${this.client.getBaseURL()}${path}`, {
            method: 'POST',
            headers: {
                authorization: (await this.client.getAuthHeaders()).authorization
            },
            body: formData
        });

        await this.client.assertOk(response, 'No pudimos previsualizar el archivo de importación');
        return response.json() as Promise<ArticleImportPreviewResponse>;
    }

    async downloadArticleImportTemplate() {
        const path = '/admin/articles/import/template';
        const response = await fetch(`${this.client.getBaseURL()}${path}`, {
            method: 'GET',
            headers: {
                ...(await this.client.getAuthHeaders())
            }
        });

        await this.client.assertOk(response, 'No pudimos descargar el template de importación');
        return response.blob();
    }


    async commitArticleImportBatch(previewId: string, rowNumbers: number[]) {
        const batchPath = '/admin/articles/import/batch';
        const payload = JSON.stringify({ previewId, rowNumbers });

        const batchResponse = await fetch(`${this.client.getBaseURL()}${batchPath}`, {
            method: 'POST',
            headers: {
                ...(await this.client.getAuthHeaders())
            },
            body: payload
        });

        const batchContentType = batchResponse.headers.get('content-type')?.toLowerCase() ?? '';
        const shouldFallbackToCommit =
            batchResponse.status === 404 &&
            !batchContentType.includes('application/json') &&
            (batchResponse.headers.get('link')?.includes('/api/admin/articles/import/batch') ?? false);

        if (!shouldFallbackToCommit) {
            await this.client.assertOk(batchResponse, 'No pudimos importar el lote de artículos');
            return batchResponse.json() as Promise<ArticleImportBatchResponse>;
        }

        const commitPath = '/admin/articles/import/commit';
        const commitResponse = await fetch(`${this.client.getBaseURL()}${commitPath}`, {
            method: 'POST',
            headers: {
                ...(await this.client.getAuthHeaders())
            },
            body: payload
        });

        await this.client.assertOk(commitResponse, 'No pudimos importar el lote de artículos');
        const commitResult = (await commitResponse.json()) as ArticleImportCommitResponse;
        const createdRows = new Set(commitResult.createdRows);

        return {
            previewId: commitResult.previewId,
            successCount: commitResult.summary.importedRows,
            failedCount: commitResult.summary.skippedRows,
            results: rowNumbers.map((rowNumber) => {
                if (createdRows.has(rowNumber)) {
                    return {
                        rowNumber,
                        sku: '',
                        status: 'created' as const
                    };
                }

                const skipped = commitResult.skippedRows.find((item) => item.rowNumber === rowNumber);
                return {
                    rowNumber,
                    sku: '',
                    status: 'rejected' as const,
                    reason: skipped?.reason ?? 'Row was skipped by commit endpoint'
                };
            })
        };
    }

    async commitArticleImport(previewId: string, rowNumbers?: number[]) {
        const path = '/admin/articles/import/commit';
        const response = await fetch(`${this.client.getBaseURL()}${path}`, {
            method: 'POST',
            headers: {
                ...(await this.client.getAuthHeaders())
            },
            body: JSON.stringify({ previewId, rowNumbers })
        });

        await this.client.assertOk(response, 'No pudimos confirmar la importación');
        return response.json() as Promise<ArticleImportCommitResponse>;
    }

    async cloneArticle(articleId: string, payload: CloneArticlePayload) {
        const path = `/articles/${articleId}/clone`;
        const response = await fetch(`${this.client.getBaseURL()}${path}`, {
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

    async updateArticle(articleId: string, payload: UpdateArticlePayload) {
        const path = `/articles/${articleId}`;
        const response = await fetch(`${this.client.getBaseURL()}${path}`, {
            method: 'PUT',
            headers: {
                ...(await this.client.getAuthHeaders())
            },
            body: JSON.stringify(payload)
        });

        const checkedResponse = await this.ensureArticlesRouteExists(response, `/articles/${articleId}`);
        await this.client.assertOk(checkedResponse, 'No pudimos actualizar el artículo');
        return checkedResponse.json() as Promise<ArticleMutationResponse>;
    }

    async deleteArticle(articleId: string) {
        const path = `/articles/${articleId}`;
        const response = await fetch(`${this.client.getBaseURL()}${path}`, {
            method: 'DELETE',
            headers: {
                ...(await this.client.getAuthHeaders())
            }
        });

        const checkedResponse = await this.ensureArticlesRouteExists(response, `/articles/${articleId}`);
        await this.client.assertOk(checkedResponse, 'No pudimos eliminar el artículo');
        return checkedResponse.json() as Promise<ArticleDeleteResponse>;
    }
}
