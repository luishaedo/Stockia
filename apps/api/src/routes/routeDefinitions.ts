export type RouteDefinition = {
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    path:
        | '/facturas'
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
        | '/admin/uploads/logo'
        | '/operations/catalogs'
        | '/admin/catalogs/:catalog/version'
        | '/operations/catalogs/version'
        | '/articles'
        | '/articles/search'
        | '/articles/:id/clone'
        | '/admin/articles/import/preview'
        | '/admin/articles/import/commit'
        | '/admin/articles/import/template';
    requiresAdminToken: boolean;
};

export const ROUTE_DEFINITIONS: RouteDefinition[] = [
    { method: 'GET', path: '/facturas', requiresAdminToken: false },
    { method: 'DELETE', path: '/facturas/:id', requiresAdminToken: true },
    { method: 'DELETE', path: '/admin/invoices/:id', requiresAdminToken: true },
    { method: 'PATCH', path: '/admin/invoices/:id/export', requiresAdminToken: true },
    { method: 'GET', path: '/admin/invoices', requiresAdminToken: true },
    { method: 'GET', path: '/admin/invoice-users', requiresAdminToken: true },
    { method: 'GET', path: '/providers', requiresAdminToken: false },
    { method: 'GET', path: '/size-tables', requiresAdminToken: false },
    { method: 'GET', path: '/facturas/:id', requiresAdminToken: false },
    { method: 'POST', path: '/facturas', requiresAdminToken: false },
    { method: 'PATCH', path: '/facturas/:id/draft', requiresAdminToken: false },
    { method: 'PATCH', path: '/facturas/:id/finalize', requiresAdminToken: false },
    { method: 'GET', path: '/admin/catalogs/:catalog', requiresAdminToken: true },
    { method: 'POST', path: '/admin/catalogs/:catalog', requiresAdminToken: true },
    { method: 'PUT', path: '/admin/catalogs/:catalog/:id', requiresAdminToken: true },
    { method: 'DELETE', path: '/admin/catalogs/:catalog/:id', requiresAdminToken: true },
    { method: 'POST', path: '/admin/uploads/logo', requiresAdminToken: true },
    { method: 'GET', path: '/operations/catalogs', requiresAdminToken: false },
    { method: 'GET', path: '/admin/catalogs/:catalog/version', requiresAdminToken: true },
    { method: 'GET', path: '/operations/catalogs/version', requiresAdminToken: false },
    { method: 'POST', path: '/articles', requiresAdminToken: false },
    { method: 'GET', path: '/articles/search', requiresAdminToken: false },
    { method: 'POST', path: '/articles/:id/clone', requiresAdminToken: false },
    { method: 'POST', path: '/admin/articles/import/preview', requiresAdminToken: true },
    { method: 'POST', path: '/admin/articles/import/commit', requiresAdminToken: true },
    { method: 'GET', path: '/admin/articles/import/template', requiresAdminToken: true }
];

export const toRouteKey = (method: RouteDefinition['method'], path: RouteDefinition['path']) => `${method} ${path}`;
