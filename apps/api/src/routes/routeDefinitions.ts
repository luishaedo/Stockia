export type RouteDefinition = {
    method: 'GET' | 'POST' | 'PATCH';
    path: '/facturas' | '/facturas/:id' | '/facturas/:id/draft' | '/facturas/:id/finalize';
    requiresAdminToken: boolean;
};

export const FACTURA_ROUTE_DEFINITIONS: RouteDefinition[] = [
    { method: 'GET', path: '/facturas', requiresAdminToken: false },
    { method: 'GET', path: '/facturas/:id', requiresAdminToken: false },
    { method: 'POST', path: '/facturas', requiresAdminToken: true },
    { method: 'PATCH', path: '/facturas/:id/draft', requiresAdminToken: true },
    { method: 'PATCH', path: '/facturas/:id/finalize', requiresAdminToken: true }
];

export const toRouteKey = (method: RouteDefinition['method'], path: RouteDefinition['path']) => `${method} ${path}`;
