import { Prisma, PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';

const REQUIRED_COLUMNS = [
    'sku',
    'description',
    'supplier_code',
    'size_curve_code'
] as const;

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];
type OptionalCodeColumn = 'family_code' | 'material_code' | 'category_code' | 'classification_code' | 'garment_type_code';

type ImportCatalogKey = 'supplier' | 'family' | 'material' | 'category' | 'classification' | 'garmentType' | 'sizeCurve';

type CatalogMatch = { id: string; code: string; label: string };

type CatalogResolution = {
    code: string;
    resolved: boolean;
    catalogId: string | null;
    warning?: string;
    error?: string;
};

export type NormalizedImportRow = {
    rowNumber: number;
    sku: string;
    description: string;
    supplierCode: string;
    supplierDescription?: string;
    familyCode: string;
    familyDescription?: string;
    materialCode: string;
    materialDescription?: string;
    categoryCode: string;
    categoryDescription?: string;
    classificationCode: string;
    classificationDescription?: string;
    garmentTypeCode: string;
    garmentTypeDescription?: string;
    sizeCurveCode: string;
    sizeCurveDescription?: string;
};

export type PreviewRowResult = {
    rowNumber: number;
    normalized: NormalizedImportRow;
    resolutions: Record<ImportCatalogKey, CatalogResolution>;
    warnings: string[];
    errors: string[];
    importable: boolean;
    duplicateInFile: boolean;
    duplicateInDatabase: boolean;
};

export type PreviewSummary = {
    totalRows: number;
    importableRows: number;
    errorRows: number;
    warningRows: number;
    duplicateInFileRows: number;
    duplicateInDatabaseRows: number;
};

export type PreviewResult = {
    fileName: string;
    rows: PreviewRowResult[];
    summary: PreviewSummary;
    missingRequiredColumns: string[];
    fileWarnings: string[];
};

type CommitPreviewResponse = {
    previewId: string;
    status: 'committed' | 'replayed';
    summary: {
        requestedRows: number;
        attemptedRows: number;
        importedRows: number;
        skippedRows: number;
    };
    createdRows: number[];
    skippedRows: Array<{ rowNumber: number; reason: string }>;
};

type BatchCommitItemResult = {
    rowNumber: number;
    sku: string;
    status: 'created' | 'rejected';
    reason?: string;
};

type BatchCommitResponse = {
    previewId: string;
    successCount: number;
    failedCount: number;
    results: BatchCommitItemResult[];
};

type PreviewStoreEntry = {
    createdAt: number;
    result: PreviewResult;
    consumedAt?: number;
    commitResult?: CommitPreviewResponse;
};

const OPTIONAL_IMPORT_CATALOG_KEYS: Array<Exclude<ImportCatalogKey, 'supplier' | 'sizeCurve'>> = [
    'family',
    'material',
    'category',
    'classification',
    'garmentType'
];

const OPTIONAL_CODE_COLUMNS: OptionalCodeColumn[] = ['family_code', 'material_code', 'category_code', 'classification_code', 'garment_type_code'];

const DESCRIPTION_COLUMNS: Record<ImportCatalogKey, string> = {
    supplier: 'supplier_description',
    family: 'family_description',
    material: 'material_description',
    category: 'category_description',
    classification: 'classification_description',
    garmentType: 'garment_type_description',
    sizeCurve: 'size_curve_description'
};

const COL_ALIASES: Record<RequiredColumn | OptionalCodeColumn | (typeof DESCRIPTION_COLUMNS)[ImportCatalogKey], string[]> = {
    sku: ['sku', 'codigo_articulo', 'codigoarticulo'],
    description: ['description', 'descripcion', 'descripcion_sku', 'descriptionsku'],
    supplier_code: ['supplier_code', 'proveedor_code', 'codigo_proveedor', 'proveedor', 'supplier'],
    family_code: ['family_code', 'family', 'familia_code', 'codigo_familia', 'familia'],
    material_code: ['material_code', 'codigo_material', 'material'],
    category_code: ['category_code', 'category', 'categoria_code', 'codigo_categoria', 'categoria'],
    classification_code: ['classification_code', 'classification', 'clasificacion_code', 'codigo_clasificacion', 'clasificacion'],
    garment_type_code: ['garment_type_code', 'type_code', 'tipo_code', 'tipo_prenda_code', 'codigo_tipo_prenda', 'type', 'tipo_prenda'],
    size_curve_code: ['size_curve_code', 'size_table_code', 'curva_code', 'codigo_curva_talles', 'curve_code', 'size_curve'],
    supplier_description: ['supplier_description', 'supplier_name', 'proveedor_descripcion', 'proveedor_nombre'],
    family_description: ['family_description', 'descripcion_familia', 'family_desc'],
    material_description: ['material_description', 'descripcion_material', 'material_desc'],
    category_description: ['category_description', 'descripcion_categoria', 'category_desc'],
    classification_description: ['classification_description', 'descripcion_clasificacion', 'classification_desc'],
    garment_type_description: ['garment_type_description', 'type_description', 'descripcion_tipo_prenda', 'descripcion_tipo', 'tipo_prenda_descripcion'],
    size_curve_description: ['size_curve_description', 'curve_description', 'descripcion_curva_talles', 'descripcion_curva']
};

const normalizeHeader = (header: unknown) => String(header ?? '').trim().toLowerCase().replace(/\s+/g, '_');
const normalizeHeaderAlias = (header: unknown) => normalizeHeader(header).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalizeText = (value: unknown) => String(value ?? '').trim();

const sameLabel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const buildCatalogMaps = async (prisma: PrismaClient) => {
    const [suppliers, families, materials, categories, classifications, garmentTypes, sizeCurves] = await Promise.all([
        prisma.supplier.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
        prisma.family.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, description: true } }),
        prisma.material.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, description: true } }),
        prisma.category.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, description: true } }),
        prisma.classification.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, description: true } }),
        prisma.garmentType.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, description: true } }),
        prisma.sizeCurve.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, description: true } })
    ]);

    const toMap = <T extends { code: string }>(items: T[]) => new Map(items.map((item) => [item.code.trim(), item]));

    return {
        supplier: toMap(suppliers.map((item) => ({ id: item.id, code: item.code, label: item.name }))),
        family: toMap(families.map((item) => ({ id: item.id, code: item.code, label: item.description }))),
        material: toMap(materials.map((item) => ({ id: item.id, code: item.code, label: item.description }))),
        category: toMap(categories.map((item) => ({ id: item.id, code: item.code, label: item.description }))),
        classification: toMap(classifications.map((item) => ({ id: item.id, code: item.code, label: item.description }))),
        garmentType: toMap(garmentTypes.map((item) => ({ id: item.id, code: item.code, label: item.description }))),
        sizeCurve: toMap(sizeCurves.map((item) => ({ id: item.id, code: item.code, label: item.description })))
    };
};

const resolveColumnName = (headers: string[], canonical: keyof typeof COL_ALIASES): string | null => {
    const aliases = COL_ALIASES[canonical];
    for (const alias of aliases) {
        const aliasKey = normalizeHeaderAlias(alias);
        const found = headers.find((header) => normalizeHeaderAlias(header) === aliasKey);
        if (found) return found;
    }
    return null;
};

const resolveCatalog = (
    catalog: ImportCatalogKey,
    code: string,
    inputLabel: string | undefined,
    map: Map<string, CatalogMatch>
): CatalogResolution => {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
        return { code: normalizedCode, resolved: false, catalogId: null, error: `Falta código de ${catalog}` };
    }

    const matched = map.get(normalizedCode);
    if (!matched) {
        return { code: normalizedCode, resolved: false, catalogId: null, error: `No se encontró el código de ${catalog} '${normalizedCode}'` };
    }

    if (inputLabel && inputLabel.trim() && !sameLabel(inputLabel, matched.label)) {
        return {
            code: normalizedCode,
            resolved: true,
            catalogId: matched.id,
            warning: `La descripción de ${catalog} no coincide para el código '${normalizedCode}': archivo='${inputLabel.trim()}', catálogo='${matched.label}'`
        };
    }

    return { code: normalizedCode, resolved: true, catalogId: matched.id };
};

const resolveOptionalCatalog = (
    catalog: Exclude<ImportCatalogKey, 'supplier' | 'sizeCurve'>,
    code: string,
    inputLabel: string | undefined,
    map: Map<string, CatalogMatch>,
    defaultCatalogId: string
): CatalogResolution => {
    const normalizedCode = code.trim();

    if (!normalizedCode) {
        return {
            code: normalizedCode,
            resolved: true,
            catalogId: defaultCatalogId,
            warning: `Sin código de ${catalog}; se usará valor por defecto.`
        };
    }

    const matched = map.get(normalizedCode);
    if (!matched) {
        return {
            code: normalizedCode,
            resolved: true,
            catalogId: defaultCatalogId,
            warning: `No se encontró el código de ${catalog} '${normalizedCode}'; se usará valor por defecto.`
        };
    }

    if (inputLabel && inputLabel.trim() && !sameLabel(inputLabel, matched.label)) {
        return {
            code: normalizedCode,
            resolved: true,
            catalogId: matched.id,
            warning: `La descripción de ${catalog} no coincide para el código '${normalizedCode}': archivo='${inputLabel.trim()}', catálogo='${matched.label}'`
        };
    }

    return { code: normalizedCode, resolved: true, catalogId: matched.id };
};

const parseFileRows = (fileBuffer: Buffer) => {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', raw: false, dense: true, cellText: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
        throw new Error('EMPTY_FILE');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        raw: false,
        defval: '',
        blankrows: false
    });

    return rows;
};

const normalizeRow = (row: Record<string, unknown>, rowNumber: number, resolvedHeaders: Record<string, string | null>) => ({
    rowNumber,
    sku: normalizeText(row[resolvedHeaders.sku ?? '']),
    description: normalizeText(row[resolvedHeaders.description ?? '']),
    supplierCode: normalizeText(row[resolvedHeaders.supplier_code ?? '']),
    supplierDescription: normalizeText(row[resolvedHeaders.supplier_description ?? '']) || undefined,
    familyCode: normalizeText(row[resolvedHeaders.family_code ?? '']),
    familyDescription: normalizeText(row[resolvedHeaders.family_description ?? '']) || undefined,
    materialCode: normalizeText(row[resolvedHeaders.material_code ?? '']),
    materialDescription: normalizeText(row[resolvedHeaders.material_description ?? '']) || undefined,
    categoryCode: normalizeText(row[resolvedHeaders.category_code ?? '']),
    categoryDescription: normalizeText(row[resolvedHeaders.category_description ?? '']) || undefined,
    classificationCode: normalizeText(row[resolvedHeaders.classification_code ?? '']),
    classificationDescription: normalizeText(row[resolvedHeaders.classification_description ?? '']) || undefined,
    garmentTypeCode: normalizeText(row[resolvedHeaders.garment_type_code ?? '']),
    garmentTypeDescription: normalizeText(row[resolvedHeaders.garment_type_description ?? '']) || undefined,
    sizeCurveCode: normalizeText(row[resolvedHeaders.size_curve_code ?? '']),
    sizeCurveDescription: normalizeText(row[resolvedHeaders.size_curve_description ?? '']) || undefined
});

export class ArticleImportService {
    private readonly previewStore = new Map<string, PreviewStoreEntry>();
    private readonly previewTtlMs = 15 * 60 * 1000;

    constructor(private readonly prisma: PrismaClient) {}

    private async resolveOptionalCatalogDefaults() {
        const [family, material, category, classification, garmentType] = await Promise.all([
            this.prisma.family.findFirst({ orderBy: { code: 'asc' }, select: { id: true } }),
            this.prisma.material.findFirst({ orderBy: { code: 'asc' }, select: { id: true } }),
            this.prisma.category.findFirst({ orderBy: { code: 'asc' }, select: { id: true } }),
            this.prisma.classification.findFirst({ orderBy: { code: 'asc' }, select: { id: true } }),
            this.prisma.garmentType.findFirst({ orderBy: { code: 'asc' }, select: { id: true } })
        ]);

        if (!family || !material || !category || !classification || !garmentType) {
            throw new Error('MISSING_OPTIONAL_CATALOG_DEFAULTS');
        }

        return {
            familyId: family.id,
            materialId: material.id,
            categoryId: category.id,
            classificationId: classification.id,
            garmentTypeId: garmentType.id
        };
    }

    buildImportTemplateWorkbook() {
        const templateHeaders = [
            'sku',
            'descripción',
            'código_proveedor',
            'descripción_proveedor',
            'código_familia',
            'descripción_familia',
            'código_material',
            'descripción_material',
            'código_categoría',
            'descripción_categoría',
            'código_clasificación',
            'descripción_clasificación',
            'código_tipo_prenda',
            'descripción_tipo_prenda',
            'código_curva_talles',
            'descripción_curva_talles'
        ];

        const worksheet = XLSX.utils.aoa_to_sheet([templateHeaders]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }

    cleanupPreviewStore(now = Date.now()) {
        for (const [previewId, entry] of this.previewStore.entries()) {
            if (now - entry.createdAt > this.previewTtlMs) {
                this.previewStore.delete(previewId);
            }
        }
    }

    async buildPreview(fileBuffer: Buffer, fileName: string) {
        this.cleanupPreviewStore();
        const rawRows = parseFileRows(fileBuffer);
        if (rawRows.length === 0) {
            return {
                previewId: null,
                result: {
                    fileName,
                    rows: [],
                    summary: {
                        totalRows: 0,
                        importableRows: 0,
                        errorRows: 0,
                        warningRows: 0,
                        duplicateInFileRows: 0,
                        duplicateInDatabaseRows: 0
                    },
                    missingRequiredColumns: [...REQUIRED_COLUMNS],
                    fileWarnings: ['El archivo no tiene filas de datos']
                } as PreviewResult
            };
        }

        const headers = Object.keys(rawRows[0]).map(normalizeHeader);
        const requiredMap = Object.fromEntries(
            REQUIRED_COLUMNS.map((column) => [column, resolveColumnName(headers, column)])
        ) as Record<RequiredColumn, string | null>;

        const optionalCodeMap = Object.fromEntries(
            OPTIONAL_CODE_COLUMNS.map((column) => [column, resolveColumnName(headers, column)])
        ) as Record<OptionalCodeColumn, string | null>;

        const descriptionMap = Object.fromEntries(
            Object.values(DESCRIPTION_COLUMNS).map((column) => [column, resolveColumnName(headers, column)])
        ) as Record<(typeof DESCRIPTION_COLUMNS)[ImportCatalogKey], string | null>;

        const missingRequiredColumns = REQUIRED_COLUMNS.filter((column) => !requiredMap[column]);
        const resolvedHeaders = { ...requiredMap, ...optionalCodeMap, ...descriptionMap };

        const normalizedRows = rawRows.map((row, index) => normalizeRow(row, index + 2, resolvedHeaders));

        const duplicatePairMap = new Map<string, number[]>();
        for (const row of normalizedRows) {
            const key = `${row.supplierCode}::${row.sku}`;
            const list = duplicatePairMap.get(key) ?? [];
            list.push(row.rowNumber);
            duplicatePairMap.set(key, list);
        }

        const dbPairs = Array.from(new Set(normalizedRows.map((row) => `${row.supplierCode}::${row.sku}`)));
        const supplierCodes = Array.from(new Set(normalizedRows.map((row) => row.supplierCode).filter(Boolean)));
        const skuCodes = Array.from(new Set(normalizedRows.map((row) => row.sku).filter(Boolean)));

        const [catalogs, existingArticles] = await Promise.all([
            buildCatalogMaps(this.prisma),
            supplierCodes.length && skuCodes.length
                ? this.prisma.article.findMany({
                    where: {
                        supplier: { code: { in: supplierCodes } },
                        sku: { in: skuCodes }
                    },
                    select: { sku: true, supplier: { select: { code: true } } }
                })
                : Promise.resolve([])
        ]);

        const defaultCatalogIds = {
            family: Array.from(catalogs.family.values())[0]?.id ?? null,
            material: Array.from(catalogs.material.values())[0]?.id ?? null,
            category: Array.from(catalogs.category.values())[0]?.id ?? null,
            classification: Array.from(catalogs.classification.values())[0]?.id ?? null,
            garmentType: Array.from(catalogs.garmentType.values())[0]?.id ?? null
        };

        const existingDbKeys = new Set(existingArticles.map((article) => `${article.supplier.code}::${article.sku}`));
        const rows: PreviewRowResult[] = normalizedRows.map((row) => {
            const warnings: string[] = [];
            const errors: string[] = [];

            const resolutions: Record<ImportCatalogKey, CatalogResolution> = {
                supplier: resolveCatalog('supplier', row.supplierCode, row.supplierDescription, catalogs.supplier),
                family: resolveOptionalCatalog('family', row.familyCode, row.familyDescription, catalogs.family, defaultCatalogIds.family ?? ''),
                material: resolveOptionalCatalog('material', row.materialCode, row.materialDescription, catalogs.material, defaultCatalogIds.material ?? ''),
                category: resolveOptionalCatalog('category', row.categoryCode, row.categoryDescription, catalogs.category, defaultCatalogIds.category ?? ''),
                classification: resolveOptionalCatalog('classification', row.classificationCode, row.classificationDescription, catalogs.classification, defaultCatalogIds.classification ?? ''),
                garmentType: resolveOptionalCatalog('garmentType', row.garmentTypeCode, row.garmentTypeDescription, catalogs.garmentType, defaultCatalogIds.garmentType ?? ''),
                sizeCurve: resolveCatalog('sizeCurve', row.sizeCurveCode, row.sizeCurveDescription, catalogs.sizeCurve)
            };

            Object.values(resolutions).forEach((resolution) => {
                if (resolution.warning) warnings.push(resolution.warning);
                if (resolution.error) errors.push(resolution.error);
            });

            for (const optionalCatalogKey of OPTIONAL_IMPORT_CATALOG_KEYS) {
                if (!defaultCatalogIds[optionalCatalogKey]) {
                    errors.push(`No hay catálogo por defecto disponible para ${optionalCatalogKey}`);
                }
            }

            const duplicateInFile = (duplicatePairMap.get(`${row.supplierCode}::${row.sku}`) ?? []).length > 1;
            const duplicateInDatabase = existingDbKeys.has(`${row.supplierCode}::${row.sku}`);

            if (duplicateInFile) {
                errors.push('supplier_code + sku duplicado dentro del archivo');
            }
            if (duplicateInDatabase) {
                errors.push('El artículo ya existe en base de datos para supplier_code + sku');
            }

            const minimalPayloadIsValid = Boolean(
                row.sku &&
                row.description &&
                resolutions.supplier.catalogId &&
                resolutions.sizeCurve.catalogId
            );

            if (!minimalPayloadIsValid) {
                errors.push('El payload no cumple las reglas de validación para crear artículos');
            }

            const importable = errors.length === 0;

            return {
                rowNumber: row.rowNumber,
                normalized: row,
                resolutions,
                warnings,
                errors,
                importable,
                duplicateInFile,
                duplicateInDatabase
            };
        });

        const result: PreviewResult = {
            fileName,
            rows,
            summary: {
                totalRows: rows.length,
                importableRows: rows.filter((row) => row.importable).length,
                errorRows: rows.filter((row) => row.errors.length > 0).length,
                warningRows: rows.filter((row) => row.warnings.length > 0).length,
                duplicateInFileRows: rows.filter((row) => row.duplicateInFile).length,
                duplicateInDatabaseRows: rows.filter((row) => row.duplicateInDatabase).length
            },
            missingRequiredColumns,
            fileWarnings: missingRequiredColumns.length > 0 ? ['Faltan columnas obligatorias'] : []
        };

        const previewId = `preview_${Math.random().toString(36).slice(2, 11)}`;
        this.previewStore.set(previewId, { createdAt: Date.now(), result });

        return { previewId, result };
    }


    private getImportableRows(entry: PreviewStoreEntry, selectedRowNumbers?: number[]) {
        const selectableSet = selectedRowNumbers?.length ? new Set(selectedRowNumbers) : null;
        return entry.result.rows.filter((row) => row.importable && (!selectableSet || selectableSet.has(row.rowNumber)));
    }

    async commitPreviewBatch(previewId: string, selectedRowNumbers?: number[]): Promise<BatchCommitResponse> {
        this.cleanupPreviewStore();
        const entry = this.previewStore.get(previewId);
        if (!entry) {
            throw new Error('PREVIEW_NOT_FOUND');
        }

        const rowsToImport = this.getImportableRows(entry, selectedRowNumbers);
        const defaults = await this.resolveOptionalCatalogDefaults();
        const results: BatchCommitItemResult[] = [];

        for (const row of rowsToImport) {
            const data: Prisma.ArticleUncheckedCreateInput = {
                sku: row.normalized.sku,
                description: row.normalized.description,
                supplierId: row.resolutions.supplier.catalogId!,
                familyId: row.resolutions.family.catalogId ?? defaults.familyId,
                materialId: row.resolutions.material.catalogId ?? defaults.materialId,
                categoryId: row.resolutions.category.catalogId ?? defaults.categoryId,
                classificationId: row.resolutions.classification.catalogId ?? defaults.classificationId,
                garmentTypeId: row.resolutions.garmentType.catalogId ?? defaults.garmentTypeId,
                sizeCurveId: row.resolutions.sizeCurve.catalogId!
            };

            try {
                await this.prisma.article.create({ data });
                results.push({ rowNumber: row.rowNumber, sku: row.normalized.sku, status: 'created' });
            } catch (error: any) {
                if (error?.code === 'P2002') {
                    results.push({
                        rowNumber: row.rowNumber,
                        sku: row.normalized.sku,
                        status: 'rejected',
                        reason: 'Duplicate SKU for supplier'
                    });
                    continue;
                }

                if (error?.code === 'P2025') {
                    results.push({
                        rowNumber: row.rowNumber,
                        sku: row.normalized.sku,
                        status: 'rejected',
                        reason: 'Catalog references could not be resolved'
                    });
                    continue;
                }

                throw error;
            }
        }

        const successCount = results.filter((item) => item.status === 'created').length;
        return {
            previewId,
            successCount,
            failedCount: results.length - successCount,
            results
        };
    }

    async commitPreview(previewId: string, selectedRowNumbers?: number[]) {
        this.cleanupPreviewStore();
        const entry = this.previewStore.get(previewId);
        if (!entry) {
            throw new Error('PREVIEW_NOT_FOUND');
        }

        if (entry.commitResult) {
            return {
                ...entry.commitResult,
                status: 'replayed' as const
            };
        }

        const rowsToImport = this.getImportableRows(entry, selectedRowNumbers);
        const defaults = await this.resolveOptionalCatalogDefaults();

        const createdRows: number[] = [];
        const skippedRows: Array<{ rowNumber: number; reason: string }> = [];

        for (const row of rowsToImport) {
            const data: Prisma.ArticleUncheckedCreateInput = {
                sku: row.normalized.sku,
                description: row.normalized.description,
                supplierId: row.resolutions.supplier.catalogId!,
                familyId: row.resolutions.family.catalogId ?? defaults.familyId,
                materialId: row.resolutions.material.catalogId ?? defaults.materialId,
                categoryId: row.resolutions.category.catalogId ?? defaults.categoryId,
                classificationId: row.resolutions.classification.catalogId ?? defaults.classificationId,
                garmentTypeId: row.resolutions.garmentType.catalogId ?? defaults.garmentTypeId,
                sizeCurveId: row.resolutions.sizeCurve.catalogId!
            };

            try {
                await this.prisma.article.create({ data });
                createdRows.push(row.rowNumber);
            } catch (error: any) {
                if (error?.code === 'P2002') {
                    skippedRows.push({ rowNumber: row.rowNumber, reason: 'Violación de restricción única al momento de confirmar' });
                    continue;
                }

                if (error?.code === 'P2025') {
                    skippedRows.push({ rowNumber: row.rowNumber, reason: 'No se pudieron resolver referencias de catálogo al momento de confirmar' });
                    continue;
                }

                throw error;
            }
        }

        const commitResult: CommitPreviewResponse = {
            previewId,
            status: 'committed',
            summary: {
                requestedRows: selectedRowNumbers?.length ?? rowsToImport.length,
                attemptedRows: rowsToImport.length,
                importedRows: createdRows.length,
                skippedRows: skippedRows.length
            },
            createdRows,
            skippedRows
        };

        entry.consumedAt = Date.now();
        entry.commitResult = commitResult;
        this.previewStore.set(previewId, entry);

        return commitResult;
    }
}

export const articleImportRequiredColumns = REQUIRED_COLUMNS;
