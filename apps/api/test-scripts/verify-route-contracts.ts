import { SHARED_ACTIVE_ROUTE_CONTRACTS } from '@stockia/shared';
import { ROUTE_DEFINITIONS, toRouteKey } from '../src/routes/routeDefinitions.js';

function assertCondition(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const sharedMap = new Map(
    SHARED_ACTIVE_ROUTE_CONTRACTS.map(route => [`${route.method} ${route.path}`, route])
);

const routeMap = new Map(
    ROUTE_DEFINITIONS.map(route => [toRouteKey(route.method, route.path), route])
);

const missingInShared: string[] = [];
for (const route of ROUTE_DEFINITIONS) {
    const key = toRouteKey(route.method, route.path);
    const sharedRoute = sharedMap.get(key);
    if (!sharedRoute) {
        missingInShared.push(key);
        continue;
    }

    assertCondition(
        sharedRoute.requiresAdminToken === route.requiresAdminToken,
        `requiresAdminToken mismatch for ${key}`
    );
}

const orphanInShared = SHARED_ACTIVE_ROUTE_CONTRACTS
    .map(route => `${route.method} ${route.path}`)
    .filter(key => !routeMap.has(key));

assertCondition(missingInShared.length === 0, `Missing route contracts in shared: ${missingInShared.join(', ')}`);
assertCondition(orphanInShared.length === 0, `Orphan route contracts in shared: ${orphanInShared.join(', ')}`);

console.log('Route contract verification passed.');
