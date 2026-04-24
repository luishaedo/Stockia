import { ROUTE_DEFINITIONS, toRouteKey } from '../routes/routeDefinitions.js';

export type RouteAuthRule = {
    requiresAdminToken: boolean;
    requiredHeader?: 'authorization';
};

export const AUTH_POLICY: Record<string, RouteAuthRule> = {
    'GET /facturas': { requiresAdminToken: false },
    'DELETE /facturas/:id': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'DELETE /admin/invoices/:id': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'PATCH /admin/invoices/:id/export': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'GET /admin/invoices': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'GET /admin/invoice-users': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'GET /providers': { requiresAdminToken: false },
    'GET /size-tables': { requiresAdminToken: false },
    'GET /facturas/:id': { requiresAdminToken: false },
    'POST /facturas': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'PATCH /facturas/:id/draft': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'PATCH /facturas/:id/finalize': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'GET /admin/catalogs/:catalog': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'GET /admin/catalogs/quick-curves': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'POST /admin/catalogs/quick-curves': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'PUT /admin/catalogs/quick-curves/:id': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'DELETE /admin/catalogs/quick-curves/:id': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'POST /admin/catalogs/:catalog': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'PUT /admin/catalogs/:catalog/:id': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'DELETE /admin/catalogs/:catalog/:id': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'POST /admin/uploads/logo': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'GET /operations/catalogs': { requiresAdminToken: false },
    'GET /admin/catalogs/:catalog/version': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'GET /operations/catalogs/version': { requiresAdminToken: false },
    'POST /articles': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'GET /articles/search': { requiresAdminToken: false },
    'PUT /articles/:id': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'DELETE /articles/:id': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'POST /suppliers': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'GET /suppliers/:supplierId/colors': { requiresAdminToken: false },
    'POST /suppliers/:supplierId/colors': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'PATCH /suppliers/:supplierId/colors/:colorId': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'DELETE /suppliers/:supplierId/colors/:colorId': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'POST /articles/:id/clone': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'POST /admin/articles/import/preview': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'POST /admin/articles/import/commit': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'POST /admin/articles/import/batch': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'GET /admin/articles/import/template': { requiresAdminToken: true, requiredHeader: 'authorization' }
};

export const assertAuthPolicyCoverage = () => {
    const missingPolicyEntries: string[] = [];
    const orphanPolicyEntries = new Set(Object.keys(AUTH_POLICY));

    for (const route of ROUTE_DEFINITIONS) {
        const routeKey = toRouteKey(route.method, route.path);
        const authRule = AUTH_POLICY[routeKey];

        if (!authRule) {
            missingPolicyEntries.push(routeKey);
            continue;
        }

        orphanPolicyEntries.delete(routeKey);

        if (authRule.requiresAdminToken !== route.requiresAdminToken) {
            throw new Error(
                `Auth policy mismatch for ${routeKey}: route requiresAdminToken=${route.requiresAdminToken}, policy requiresAdminToken=${authRule.requiresAdminToken}`
            );
        }
    }

    if (missingPolicyEntries.length > 0 || orphanPolicyEntries.size > 0) {
        throw new Error(
            `Auth policy coverage failed. Missing: [${missingPolicyEntries.join(', ')}]. Orphan: [${Array.from(orphanPolicyEntries).join(', ')}]`
        );
    }
};
