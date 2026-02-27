import { Response } from 'express';

export type DeprecationPolicy = {
    routeName: string;
    migrationPath: string;
    owner: string;
    introducedAt: string;
    deprecatedAt: string;
    sunsetAt: string;
    rollbackStrategy: string;
    deprecationLink?: string;
};

const toRfc1123Date = (input: string) => {
    const parsed = new Date(input);
    if (Number.isNaN(parsed.valueOf())) {
        throw new Error(`Invalid sunset date '${input}' for deprecation policy`);
    }

    return parsed.toUTCString();
};

export const applyDeprecationHeaders = (response: Response, policy: DeprecationPolicy) => {
    response.setHeader('Deprecation', 'true');
    response.setHeader('Sunset', toRfc1123Date(policy.sunsetAt));

    if (policy.deprecationLink) {
        response.setHeader('Link', `<${policy.deprecationLink}>; rel="deprecation"; type="text/markdown"`);
    }
};

export const LEGACY_ROUTE_POLICIES = {
    providers: {
        routeName: 'GET /providers',
        migrationPath: 'GET /operations/catalogs -> suppliers',
        owner: 'API Platform',
        introducedAt: '2026-01-10T00:00:00Z',
        deprecatedAt: '2026-02-27T00:00:00Z',
        sunsetAt: '2026-05-01T00:00:00Z',
        rollbackStrategy: 'Re-enable providers route behind legacy route feature toggle from previous release artifact',
        deprecationLink: 'https://example.internal/docs/migrations/providers-to-operations-catalogs.md'
    },
    sizeTables: {
        routeName: 'GET /size-tables',
        migrationPath: 'GET /operations/catalogs -> curves',
        owner: 'API Platform',
        introducedAt: '2026-01-10T00:00:00Z',
        deprecatedAt: '2026-02-27T00:00:00Z',
        sunsetAt: '2026-05-01T00:00:00Z',
        rollbackStrategy: 'Re-enable size-tables route behind legacy route feature toggle from previous release artifact',
        deprecationLink: 'https://example.internal/docs/migrations/size-tables-to-operations-catalogs.md'
    }
} satisfies Record<string, DeprecationPolicy>;
