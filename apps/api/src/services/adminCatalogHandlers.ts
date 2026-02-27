import { Prisma, PrismaClient } from '@prisma/client';

export const ADMIN_CATALOGS = [
    'suppliers',
    'size-curves',
    'families',
    'categories',
    'garment-types',
    'materials',
    'classifications'
] as const;

export type CatalogKey = (typeof ADMIN_CATALOGS)[number];

type CatalogField = 'name' | 'description' | 'logoUrl' | 'longDescription';

type CatalogConfig = {
    requiredFields: CatalogField[];
    optionalFields: CatalogField[];
};

const CATALOG_CONFIG: Record<CatalogKey, CatalogConfig> = {
    suppliers: { requiredFields: ['name'], optionalFields: ['logoUrl'] },
    'size-curves': { requiredFields: ['description'], optionalFields: [] },
    families: { requiredFields: ['description'], optionalFields: [] },
    categories: { requiredFields: ['description'], optionalFields: ['logoUrl', 'longDescription'] },
    'garment-types': { requiredFields: ['description'], optionalFields: [] },
    materials: { requiredFields: ['description'], optionalFields: [] },
    classifications: { requiredFields: ['description'], optionalFields: [] }
};

export type CatalogPayload = {
    code?: string;
    name?: string;
    description?: string;
    logoUrl?: string;
    longDescription?: string;
    values?: string[];
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const normalizeSizeValues = (rawValues: unknown): string[] => {
    if (!Array.isArray(rawValues)) return [];
    return rawValues
        .filter((value): value is string => typeof value === 'string')
        .map(value => value.trim())
        .filter(Boolean);
};

export const buildCatalogDataPayload = (catalog: CatalogKey, payload: CatalogPayload) => {
    const config = CATALOG_CONFIG[catalog];
    const data: Record<string, unknown> = { code: payload.code?.trim() };

    for (const field of [...config.requiredFields, ...config.optionalFields]) {
        const value = payload[field];
        if (typeof value === 'string') {
            data[field] = value.trim();
        }
    }

    return data;
};

export const validateCatalogPayload = (catalog: CatalogKey, payload: CatalogPayload) => {
    if (!isNonEmptyString(payload.code)) {
        return 'Field code is required';
    }

    const config = CATALOG_CONFIG[catalog];
    for (const field of config.requiredFields) {
        if (!isNonEmptyString(payload[field])) {
            return `Field ${field} is required`;
        }
    }

    if (catalog === 'size-curves') {
        const values = normalizeSizeValues(payload.values);
        if (values.length === 0) {
            return 'Field values is required and must include at least one size value';
        }
    }

    return null;
};

export interface CatalogHandler<TRecord, TDataInput> {
    list(): Promise<TRecord[]>;
    create(payload: TDataInput): Promise<TRecord>;
    update(id: string, payload: TDataInput): Promise<TRecord>;
    remove(id: string): Promise<unknown>;
}

const createCrudCatalogHandler = <
    TRecord,
    TCreateInput extends Record<string, unknown>,
    TUpdateInput extends Record<string, unknown>
>(params: {
    list: () => Promise<TRecord[]>;
    create: (data: TCreateInput) => Promise<TRecord>;
    update: (id: string, data: TUpdateInput) => Promise<TRecord>;
    remove: (id: string) => Promise<unknown>;
}): CatalogHandler<TRecord, TCreateInput & TUpdateInput> => ({
    list: params.list,
    create: (payload) => params.create(payload as TCreateInput),
    update: (id, payload) => params.update(id, payload as TUpdateInput),
    remove: async (id) => {
        await params.remove(id);
    }
});

const createSizeCurveHandler = (prisma: PrismaClient): CatalogHandler<Prisma.SizeCurveGetPayload<{ include: { values: { orderBy: { sortOrder: 'asc' } } } }>, Record<string, unknown>> => ({
    list: () => prisma.sizeCurve.findMany({ include: { values: { orderBy: { sortOrder: 'asc' } } }, orderBy: { code: 'asc' } }),
    create: async (payload) => {
        const values = normalizeSizeValues(payload.values);
        return prisma.sizeCurve.create({
            data: {
                ...(payload as Prisma.SizeCurveUncheckedCreateInput),
                values: {
                    create: values.map((value, index) => ({ value, sortOrder: index }))
                }
            },
            include: { values: { orderBy: { sortOrder: 'asc' } } }
        });
    },
    update: async (id, payload) => {
        const values = normalizeSizeValues(payload.values);
        return prisma.$transaction(async (tx) => {
            await tx.sizeCurveValue.deleteMany({ where: { sizeCurveId: id } });
            return tx.sizeCurve.update({
                where: { id },
                data: {
                    ...(payload as Prisma.SizeCurveUncheckedUpdateInput),
                    values: {
                        create: values.map((value, index) => ({ value, sortOrder: index }))
                    }
                },
                include: { values: { orderBy: { sortOrder: 'asc' } } }
            });
        });
    },
    remove: (id) => prisma.sizeCurve.delete({ where: { id } })
});

export const createAdminCatalogHandlers = (prisma: PrismaClient): Record<CatalogKey, CatalogHandler<unknown, Record<string, unknown>>> => ({
    suppliers: createCrudCatalogHandler({
        list: () => prisma.supplier.findMany({ orderBy: { code: 'asc' } }),
        create: (data: Prisma.SupplierUncheckedCreateInput) => prisma.supplier.create({ data }),
        update: (id, data: Prisma.SupplierUncheckedUpdateInput) => prisma.supplier.update({ where: { id }, data }),
        remove: (id) => prisma.supplier.delete({ where: { id } })
    }),
    families: createCrudCatalogHandler({
        list: () => prisma.family.findMany({ orderBy: { code: 'asc' } }),
        create: (data: Prisma.FamilyUncheckedCreateInput) => prisma.family.create({ data }),
        update: (id, data: Prisma.FamilyUncheckedUpdateInput) => prisma.family.update({ where: { id }, data }),
        remove: (id) => prisma.family.delete({ where: { id } })
    }),
    categories: createCrudCatalogHandler({
        list: () => prisma.category.findMany({ orderBy: { code: 'asc' } }),
        create: (data: Prisma.CategoryUncheckedCreateInput) => prisma.category.create({ data }),
        update: (id, data: Prisma.CategoryUncheckedUpdateInput) => prisma.category.update({ where: { id }, data }),
        remove: (id) => prisma.category.delete({ where: { id } })
    }),
    'garment-types': createCrudCatalogHandler({
        list: () => prisma.garmentType.findMany({ orderBy: { code: 'asc' } }),
        create: (data: Prisma.GarmentTypeUncheckedCreateInput) => prisma.garmentType.create({ data }),
        update: (id, data: Prisma.GarmentTypeUncheckedUpdateInput) => prisma.garmentType.update({ where: { id }, data }),
        remove: (id) => prisma.garmentType.delete({ where: { id } })
    }),
    materials: createCrudCatalogHandler({
        list: () => prisma.material.findMany({ orderBy: { code: 'asc' } }),
        create: (data: Prisma.MaterialUncheckedCreateInput) => prisma.material.create({ data }),
        update: (id, data: Prisma.MaterialUncheckedUpdateInput) => prisma.material.update({ where: { id }, data }),
        remove: (id) => prisma.material.delete({ where: { id } })
    }),
    classifications: createCrudCatalogHandler({
        list: () => prisma.classification.findMany({ orderBy: { code: 'asc' } }),
        create: (data: Prisma.ClassificationUncheckedCreateInput) => prisma.classification.create({ data }),
        update: (id, data: Prisma.ClassificationUncheckedUpdateInput) => prisma.classification.update({ where: { id }, data }),
        remove: (id) => prisma.classification.delete({ where: { id } })
    }),
    'size-curves': createSizeCurveHandler(prisma)
});

export const isCatalogKey = (value: string): value is CatalogKey => (ADMIN_CATALOGS as readonly string[]).includes(value);

export const impactsOperationsCatalogs = (catalog: CatalogKey) =>
    catalog === 'suppliers' || catalog === 'families' || catalog === 'size-curves';
