import { OperationCatalogsResponse } from '@stockia/shared';
import { AdminCatalogKey } from './types';

const CATALOG_CACHE_TTL_MS = 60_000;
const OPERATIONS_CATALOG_TTL_MS = 300_000;

type CacheEntry<T> = {
    expiresAt: number;
    version: string;
    data: T;
};

class CatalogCacheStore {
    private adminCache = new Map<AdminCatalogKey, CacheEntry<unknown>>();
    private operationsCache: CacheEntry<OperationCatalogsResponse> | null = null;

    getAdminCatalog<T>(catalog: AdminCatalogKey): CacheEntry<T> | null {
        const cached = this.adminCache.get(catalog);
        if (!cached || cached.expiresAt <= Date.now()) {
            return null;
        }
        return cached as CacheEntry<T>;
    }

    setAdminCatalog<T>(catalog: AdminCatalogKey, data: T, version: string) {
        this.adminCache.set(catalog, {
            data,
            version,
            expiresAt: Date.now() + CATALOG_CACHE_TTL_MS
        });
    }

    invalidateAdminCatalog(catalog?: AdminCatalogKey) {
        if (!catalog) {
            this.adminCache.clear();
            return;
        }
        this.adminCache.delete(catalog);
    }

    getOperationsCatalogs() {
        if (!this.operationsCache || this.operationsCache.expiresAt <= Date.now()) {
            return null;
        }
        return this.operationsCache;
    }

    setOperationsCatalogs(data: OperationCatalogsResponse, version: string) {
        this.operationsCache = {
            data,
            version,
            expiresAt: Date.now() + OPERATIONS_CATALOG_TTL_MS
        };
    }

    invalidateOperationsCatalogs() {
        this.operationsCache = null;
    }
}

export const catalogCacheStore = new CatalogCacheStore();
