export type RouteDefinition = {
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    path:
        | '/facturas'
        | '/admin/invoices'
        | '/admin/invoice-users'
        | '/providers'
        | '/size-tables'
        | '/facturas/:id'
        | '/facturas/:id/draft'
        | '/facturas/:id/finalize'
        | '/admin/catalogs/:catalog'
        | '/admin/catalogs/:catalog/:id'
        | '/admin/uploads/logo'
        | '/operations/catalogs'
        | '/admin/catalogs/:catalog/version'
        | '/operations/catalogs/version';
    requiresAdminToken: boolean;
};

export const ROUTE_DEFINITIONS: RouteDefinition[] = [
    { method: 'GET', path: '/facturas', requiresAdminToken: true },
    { method: 'GET', path: '/admin/invoices', requiresAdminToken: true },
    { method: 'GET', path: '/admin/invoice-users', requiresAdminToken: true },
    { method: 'GET', path: '/providers', requiresAdminToken: true },
    { method: 'GET', path: '/size-tables', requiresAdminToken: true },
    { method: 'GET', path: '/facturas/:id', requiresAdminToken: true },
    { method: 'POST', path: '/facturas', requiresAdminToken: true },
    { method: 'PATCH', path: '/facturas/:id/draft', requiresAdminToken: true },
    { method: 'PATCH', path: '/facturas/:id/finalize', requiresAdminToken: true },
    { method: 'GET', path: '/admin/catalogs/:catalog', requiresAdminToken: true },
    { method: 'POST', path: '/admin/catalogs/:catalog', requiresAdminToken: true },
    { method: 'PUT', path: '/admin/catalogs/:catalog/:id', requiresAdminToken: true },
    { method: 'DELETE', path: '/admin/catalogs/:catalog/:id', requiresAdminToken: true },
    { method: 'POST', path: '/admin/uploads/logo', requiresAdminToken: true },
    { method: 'GET', path: '/operations/catalogs', requiresAdminToken: true },
    { method: 'GET', path: '/admin/catalogs/:catalog/version', requiresAdminToken: true },
    { method: 'GET', path: '/operations/catalogs/version', requiresAdminToken: true }
];

export const toRouteKey = (method: RouteDefinition['method'], path: RouteDefinition['path']) => `${method} ${path}`;
