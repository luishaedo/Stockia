import { PrismaClient } from '@prisma/client';

export const OPTIONAL_ARTICLE_DEFAULT_CODES = {
    family: '06',
    material: '99',
    category: '99',
    classification: '99',
    garmentType: '99'
} as const;

export type OptionalArticleDefaults = {
    familyId: string;
    materialId: string;
    categoryId: string;
    classificationId: string;
    garmentTypeId: string;
};

export type OptionalArticleDefaultReadiness = {
    ready: boolean;
    configuredCodes: typeof OPTIONAL_ARTICLE_DEFAULT_CODES;
    resolvedIds: Partial<OptionalArticleDefaults>;
    missingCatalogs: string[];
};

export class MissingOptionalCatalogDefaultsError extends Error {
    constructor(public readonly missingCatalogs: string[]) {
        super('MISSING_OPTIONAL_CATALOG_DEFAULTS');
        this.name = 'MissingOptionalCatalogDefaultsError';
    }
}

export const getOptionalCatalogDefaultReadiness = async (prisma: PrismaClient): Promise<OptionalArticleDefaultReadiness> => {
    const [family, material, category, classification, garmentType] = await Promise.all([
        prisma.family.findFirst({ where: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.family }, select: { id: true } }),
        prisma.material.findFirst({ where: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.material }, select: { id: true } }),
        prisma.category.findFirst({ where: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.category }, select: { id: true } }),
        prisma.classification.findFirst({ where: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.classification }, select: { id: true } }),
        prisma.garmentType.findFirst({ where: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.garmentType }, select: { id: true } })
    ]);

    const missingCatalogs: string[] = [];
    const resolvedIds: Partial<OptionalArticleDefaults> = {};

    if (family) {
        resolvedIds.familyId = family.id;
    } else {
        missingCatalogs.push(`family(code=${OPTIONAL_ARTICLE_DEFAULT_CODES.family})`);
    }

    if (material) {
        resolvedIds.materialId = material.id;
    } else {
        missingCatalogs.push(`material(code=${OPTIONAL_ARTICLE_DEFAULT_CODES.material})`);
    }

    if (category) {
        resolvedIds.categoryId = category.id;
    } else {
        missingCatalogs.push(`category(code=${OPTIONAL_ARTICLE_DEFAULT_CODES.category})`);
    }

    if (classification) {
        resolvedIds.classificationId = classification.id;
    } else {
        missingCatalogs.push(`classification(code=${OPTIONAL_ARTICLE_DEFAULT_CODES.classification})`);
    }

    if (garmentType) {
        resolvedIds.garmentTypeId = garmentType.id;
    } else {
        missingCatalogs.push(`garmentType(code=${OPTIONAL_ARTICLE_DEFAULT_CODES.garmentType})`);
    }

    return {
        ready: missingCatalogs.length === 0,
        configuredCodes: OPTIONAL_ARTICLE_DEFAULT_CODES,
        resolvedIds,
        missingCatalogs
    };
};

export const resolveOptionalCatalogDefaults = async (prisma: PrismaClient): Promise<OptionalArticleDefaults> => {
    const readiness = await getOptionalCatalogDefaultReadiness(prisma);
    if (!readiness.ready) {
        throw new MissingOptionalCatalogDefaultsError(readiness.missingCatalogs);
    }

    return readiness.resolvedIds as OptionalArticleDefaults;
};
