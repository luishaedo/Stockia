import { FACTURA_ROUTE_DEFINITIONS, toRouteKey } from '../routes/routeDefinitions.js';

export type RouteAuthRule = {
    requiresAdminToken: boolean;
    requiredHeader?: 'authorization';
};

export const AUTH_POLICY: Record<string, RouteAuthRule> = {
    'GET /facturas': { requiresAdminToken: false },
    'GET /facturas/:id': { requiresAdminToken: false },
    'POST /facturas': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'PATCH /facturas/:id/draft': { requiresAdminToken: true, requiredHeader: 'authorization' },
    'PATCH /facturas/:id/finalize': { requiresAdminToken: true, requiredHeader: 'authorization' }
};

export const assertAuthPolicyCoverage = () => {
    const missingPolicyEntries: string[] = [];
    const orphanPolicyEntries = new Set(Object.keys(AUTH_POLICY));

    for (const route of FACTURA_ROUTE_DEFINITIONS) {
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
