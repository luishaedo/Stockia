const VERSION_SEED = Date.now();

const adminCatalogVersions = new Map<string, number>();
let operationsCatalogVersion = VERSION_SEED;

const buildVersionTag = (version: number) => `W/\"${version}\"`;

const getCurrentVersion = (current?: number) => current ?? VERSION_SEED;

export const catalogVersionStore = {
    getAdminCatalogVersion(catalog: string): string {
        return buildVersionTag(getCurrentVersion(adminCatalogVersions.get(catalog)));
    },
    bumpAdminCatalogVersion(catalog: string): string {
        const next = Date.now();
        adminCatalogVersions.set(catalog, next);
        return buildVersionTag(next);
    },
    getOperationsCatalogVersion(): string {
        return buildVersionTag(operationsCatalogVersion);
    },
    bumpOperationsCatalogVersion(): string {
        operationsCatalogVersion = Date.now();
        return buildVersionTag(operationsCatalogVersion);
    }
};
