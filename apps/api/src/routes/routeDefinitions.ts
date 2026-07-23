export type RouteDefinition = {
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    path:
        | '/facturas'
        | '/invoices/by-article/:articleQuery'
        | '/facturas/by-article/:articleQuery'
        | '/admin/invoices/:id'
        | '/facturas/:id'
        | '/admin/invoices/:id/export'
        | '/admin/invoices'
        | '/admin/invoice-users'
        | '/providers'
        | '/size-tables'
        | '/facturas/:id/draft'
        | '/facturas/:id/finalize'
        | '/admin/catalogs/:catalog'
        | '/admin/catalogs/:catalog/:id'
        | '/admin/catalogs/quick-curves'
        | '/admin/catalogs/quick-curves/:id'
        | '/admin/uploads/logo'
        | '/operations/catalogs'
        | '/admin/catalogs/:catalog/version'
        | '/operations/catalogs/version'
        | '/articles'
        | '/articles/search'
        | '/articles/:id'
        | '/suppliers'
        | '/suppliers/:supplierId/colors'
        | '/suppliers/:supplierId/colors/:colorId'
        | '/articles/:id/clone'
        | '/admin/articles/import/preview'
        | '/admin/articles/import/commit'
        | '/admin/articles/import/batch'
        | '/admin/articles/import/template'
        | '/admin/articles/import/readiness'
        | '/dragonfish-equivalences'
        | '/dragonfish-equivalences/:id'
        | '/dragonfish-equivalences/import/template'
        | '/dragonfish-equivalences/import/preview'
        | '/dragonfish-equivalences/import/commit'
        | '/facturas/:id/dragonfish-export';
    requiresAdminToken: boolean;
};

export const ROUTE_DEFINITIONS: RouteDefinition[] = [
    { method: 'GET', path: '/facturas', requiresAdminToken: false },
    { method: 'GET', path: '/invoices/by-article/:articleQuery', requiresAdminToken: false },
    { method: 'GET', path: '/facturas/by-article/:articleQuery', requiresAdminToken: false },
    { method: 'DELETE', path: '/facturas/:id', requiresAdminToken: true },
    { method: 'DELETE', path: '/admin/invoices/:id', requiresAdminToken: true },
    { method: 'PATCH', path: '/admin/invoices/:id/export', requiresAdminToken: true },
    { method: 'GET', path: '/admin/invoices', requiresAdminToken: true },
    { method: 'GET', path: '/admin/invoice-users', requiresAdminToken: true },
    { method: 'GET', path: '/providers', requiresAdminToken: false },
    { method: 'GET', path: '/size-tables', requiresAdminToken: false },
    { method: 'GET', path: '/facturas/:id', requiresAdminToken: false },
    { method: 'POST', path: '/facturas', requiresAdminToken: true },
    { method: 'PATCH', path: '/facturas/:id/draft', requiresAdminToken: true },
    { method: 'PATCH', path: '/facturas/:id/finalize', requiresAdminToken: true },
    { method: 'GET', path: '/admin/catalogs/:catalog', requiresAdminToken: true },
    { method: 'GET', path: '/admin/catalogs/quick-curves', requiresAdminToken: true },
    { method: 'POST', path: '/admin/catalogs/quick-curves', requiresAdminToken: true },
    { method: 'PUT', path: '/admin/catalogs/quick-curves/:id', requiresAdminToken: true },
    { method: 'DELETE', path: '/admin/catalogs/quick-curves/:id', requiresAdminToken: true },
    { method: 'POST', path: '/admin/catalogs/:catalog', requiresAdminToken: true },
    { method: 'PUT', path: '/admin/catalogs/:catalog/:id', requiresAdminToken: true },
    { method: 'DELETE', path: '/admin/catalogs/:catalog/:id', requiresAdminToken: true },
    { method: 'POST', path: '/admin/uploads/logo', requiresAdminToken: true },
    { method: 'GET', path: '/operations/catalogs', requiresAdminToken: false },
    { method: 'GET', path: '/admin/catalogs/:catalog/version', requiresAdminToken: true },
    { method: 'GET', path: '/operations/catalogs/version', requiresAdminToken: false },
    { method: 'POST', path: '/articles', requiresAdminToken: true },
    { method: 'GET', path: '/articles/search', requiresAdminToken: false },
    { method: 'PUT', path: '/articles/:id', requiresAdminToken: true },
    { method: 'DELETE', path: '/articles/:id', requiresAdminToken: true },
    { method: 'POST', path: '/suppliers', requiresAdminToken: true },
    { method: 'GET', path: '/suppliers/:supplierId/colors', requiresAdminToken: false },
    { method: 'POST', path: '/suppliers/:supplierId/colors', requiresAdminToken: true },
    { method: 'PATCH', path: '/suppliers/:supplierId/colors/:colorId', requiresAdminToken: true },
    { method: 'DELETE', path: '/suppliers/:supplierId/colors/:colorId', requiresAdminToken: true },
    { method: 'POST', path: '/articles/:id/clone', requiresAdminToken: true },
    { method: 'POST', path: '/admin/articles/import/preview', requiresAdminToken: true },
    { method: 'POST', path: '/admin/articles/import/commit', requiresAdminToken: true },
    { method: 'POST', path: '/admin/articles/import/batch', requiresAdminToken: true },
    { method: 'GET', path: '/admin/articles/import/template', requiresAdminToken: true },
    { method: 'GET', path: '/admin/articles/import/readiness', requiresAdminToken: true },
    { method: 'GET', path: '/dragonfish-equivalences', requiresAdminToken: true },
    { method: 'POST', path: '/dragonfish-equivalences', requiresAdminToken: true },
    { method: 'PUT', path: '/dragonfish-equivalences/:id', requiresAdminToken: true },
    { method: 'DELETE', path: '/dragonfish-equivalences/:id', requiresAdminToken: true },
    { method: 'GET', path: '/dragonfish-equivalences/import/template', requiresAdminToken: true },
    { method: 'POST', path: '/dragonfish-equivalences/import/preview', requiresAdminToken: true },
    { method: 'POST', path: '/dragonfish-equivalences/import/commit', requiresAdminToken: true },
    { method: 'GET', path: '/facturas/:id/dragonfish-export', requiresAdminToken: true }
];

export const toRouteKey = (method: RouteDefinition['method'], path: RouteDefinition['path']) => `${method} ${path}`;
