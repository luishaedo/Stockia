import { AuthApiService } from './authApi';
import { FacturasApiService } from './facturasApi';
import { AdminApiService } from './adminApi';
import { CatalogsApiService } from './catalogsApi';
import { ArticlesApiService } from './articlesApi';
import { ApiError, authTokenStore, HttpClient } from './httpClient';

export { ApiError, authTokenStore };
export type { AdminCatalogKey } from './types';

const client = new HttpClient();

class ApiFacade {
    private authApi = new AuthApiService(client);
    private facturasApi = new FacturasApiService(client);
    private adminApi = new AdminApiService(client);
    private catalogsApi = new CatalogsApiService(client);
    private articlesApi = new ArticlesApiService(client);

    login = this.authApi.login.bind(this.authApi);

    getFactura = this.facturasApi.getFactura.bind(this.facturasApi);
    createFactura = this.facturasApi.createFactura.bind(this.facturasApi);
    updateFacturaDraft = this.facturasApi.updateFacturaDraft.bind(this.facturasApi);
    getFacturas = this.facturasApi.getFacturas.bind(this.facturasApi);
    finalizeFactura = this.facturasApi.finalizeFactura.bind(this.facturasApi);
    deleteFactura = this.facturasApi.deleteFactura.bind(this.facturasApi);

    getAdminInvoices = this.adminApi.getAdminInvoices.bind(this.adminApi);
    getAdminInvoiceUsers = this.adminApi.getAdminInvoiceUsers.bind(this.adminApi);
    deleteAdminInvoice = this.adminApi.deleteAdminInvoice.bind(this.adminApi);
    exportAdminInvoice = this.adminApi.exportAdminInvoice.bind(this.adminApi);
    uploadAdminLogo = this.adminApi.uploadAdminLogo.bind(this.adminApi);
    resolveAssetUrl = this.adminApi.resolveAssetUrl.bind(this.adminApi);

    getOperationsCatalogs = this.catalogsApi.getOperationsCatalogs.bind(this.catalogsApi);
    preloadAdminCatalogsIncremental = this.catalogsApi.preloadAdminCatalogsIncremental.bind(this.catalogsApi);
    getAdminCatalog = this.catalogsApi.getAdminCatalog.bind(this.catalogsApi);
    getAdminCatalogCached = this.catalogsApi.getAdminCatalogCached.bind(this.catalogsApi);
    invalidateCatalogCache = this.catalogsApi.invalidateCatalogCache.bind(this.catalogsApi);
    createAdminCatalog = this.catalogsApi.createAdminCatalog.bind(this.catalogsApi);
    updateAdminCatalog = this.catalogsApi.updateAdminCatalog.bind(this.catalogsApi);
    deleteAdminCatalog = this.catalogsApi.deleteAdminCatalog.bind(this.catalogsApi);

    searchArticles = this.articlesApi.searchArticles.bind(this.articlesApi);
    createArticle = this.articlesApi.createArticle.bind(this.articlesApi);
    cloneArticle = this.articlesApi.cloneArticle.bind(this.articlesApi);
    previewArticleImport = this.articlesApi.previewArticleImport.bind(this.articlesApi);
    commitArticleImport = this.articlesApi.commitArticleImport.bind(this.articlesApi);
}

export const api = new ApiFacade();
