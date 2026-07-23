import { Prisma, PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';

export const NO_COLOR_CODE = '$';

const PREVIEW_TTL_MS = 30 * 60 * 1000;
const IMPORT_HEADERS = [
    'supplier_code',
    'article_sku',
    'article_description',
    'color_code',
    'color_description',
    'dragonfish_code'
] as const;

type ImportRow = {
    rowNumber: number;
    supplierCode: string;
    articleSku: string;
    articleDescription: string;
    colorCode: string;
    colorDescription: string;
    dragonfishCode: string;
    articleId: string | null;
    warnings: string[];
    errors: string[];
    importable: boolean;
    action: 'create' | 'update' | 'unchanged';
};

type ImportPreview = {
    fileName: string;
    missingRequiredColumns: string[];
    rows: ImportRow[];
    summary: {
        totalRows: number;
        importableRows: number;
        errorRows: number;
        warningRows: number;
        createRows: number;
        updateRows: number;
        unchangedRows: number;
    };
};

type PreviewStoreEntry = {
    createdAt: number;
    result: ImportPreview;
};

export class DragonfishEquivalenceError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status: number,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = 'DragonfishEquivalenceError';
    }
}

export const normalizeDragonfishColorCode = (value: unknown) => {
    const normalized = String(value ?? '').trim().toUpperCase();
    return normalized || NO_COLOR_CODE;
};

export const normalizeDragonfishCode = (value: unknown) => String(value ?? '').trim().toUpperCase();

const normalizeLookup = (value: unknown) => String(value ?? '').trim().toUpperCase();
const normalizeHeader = (value: unknown) => String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

const sanitizeFileNamePart = (value: string) => value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '');

const formatDatePart = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};

export const buildDragonfishLine = (quantity: number, dragonfishCode: string, size: string) =>
    `${quantity}+${dragonfishCode}!!${size}`;

export const buildDragonfishContent = (variants: Array<{
    dragonfishCode: string;
    quantities: Record<string, unknown>;
}>) => {
    const lines: string[] = [];
    for (const variant of variants) {
        for (const [size, rawQuantity] of Object.entries(variant.quantities)) {
            const quantity = Number(rawQuantity);
            if (!Number.isFinite(quantity) || quantity <= 0) continue;
            lines.push(buildDragonfishLine(quantity, variant.dragonfishCode, size));
        }
    }
    return `${lines.join('\n')}${lines.length > 0 ? '\n' : ''}`;
};

const hasPositiveQuantity = (quantities: unknown) => {
    if (!quantities || typeof quantities !== 'object' || Array.isArray(quantities)) return false;
    return Object.values(quantities as Record<string, unknown>)
        .some((value) => Number.isFinite(Number(value)) && Number(value) > 0);
};

const toRecord = (value: unknown) => (
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
);

export class DragonfishEquivalenceService {
    private readonly previewStore = new Map<string, PreviewStoreEntry>();

    constructor(private readonly prisma: PrismaClient) {}

    private cleanupPreviewStore() {
        const oldestAllowed = Date.now() - PREVIEW_TTL_MS;
        for (const [previewId, entry] of this.previewStore.entries()) {
            if (entry.createdAt < oldestAllowed) this.previewStore.delete(previewId);
        }
    }

    private async assertArticle(articleId: string) {
        const article = await this.prisma.article.findUnique({
            where: { id: articleId },
            include: { supplier: true }
        });
        if (!article) {
            throw new DragonfishEquivalenceError('NOT_FOUND', 'Artículo no encontrado', 404);
        }
        return article;
    }

    private async assertDragonfishCodeAvailable(dragonfishCode: string, excludedId?: string) {
        const existing = await this.prisma.dragonfishEquivalence.findUnique({
            where: { dragonfishCode }
        });
        if (existing && existing.id !== excludedId) {
            throw new DragonfishEquivalenceError(
                'UNIQUE_CONSTRAINT_VIOLATION',
                'El código Dragonfish ya está asignado a otro artículo o color',
                409,
                { dragonfishCode, equivalenceId: existing.id }
            );
        }
    }

    async list(query: {
        supplierId?: string;
        articleId?: string;
        q?: string;
        status: 'all' | 'mapped' | 'pending';
        page: number;
        pageSize: number;
    }) {
        const articleWhere: Prisma.ArticleWhereInput = {
            ...(query.supplierId ? { supplierId: query.supplierId } : {}),
            ...(query.articleId ? { id: query.articleId } : {})
        };

        const mappings = await this.prisma.dragonfishEquivalence.findMany({
            where: { article: articleWhere },
            include: { article: { include: { supplier: true } } },
            orderBy: [{ updatedAt: 'desc' }]
        });

        const supplierIds = Array.from(new Set(mappings.map((mapping) => mapping.article.supplierId)));
        if (query.supplierId && !supplierIds.includes(query.supplierId)) supplierIds.push(query.supplierId);

        const supplierColors = await this.prisma.supplierColor.findMany({
            where: supplierIds.length > 0 ? { supplierId: { in: supplierIds } } : undefined
        });
        const colorLabels = new Map(
            supplierColors.map((color) => [`${color.supplierId}|${normalizeLookup(color.code)}`, color.value])
        );

        const mappedRows = mappings.map((mapping) => ({
            id: mapping.id,
            status: 'mapped' as const,
            articleId: mapping.articleId,
            supplier: {
                id: mapping.article.supplier.id,
                code: mapping.article.supplier.code,
                label: mapping.article.supplier.name
            },
            article: {
                sku: mapping.article.sku,
                description: mapping.article.description
            },
            colorCode: mapping.colorCode,
            colorDescription: mapping.colorCode === NO_COLOR_CODE
                ? 'SIN COLOR'
                : colorLabels.get(`${mapping.article.supplierId}|${mapping.colorCode}`) || mapping.colorCode,
            dragonfishCode: mapping.dragonfishCode,
            updatedAt: mapping.updatedAt
        }));

        const mappedKeys = new Set(mappings.map((mapping) => `${mapping.articleId}|${mapping.colorCode}`));
        const pendingRows: Array<{
            id: null;
            status: 'pending';
            articleId: string;
            supplier: { id: string; code: string; label: string };
            article: { sku: string; description: string };
            colorCode: string;
            colorDescription: string;
            dragonfishCode: null;
            updatedAt: null;
        }> = [];

        if (query.status !== 'mapped') {
            const usedVariants = await this.prisma.facturaItemColor.findMany({
                where: {
                    facturaItem: {
                        articleId: { not: null },
                        article: articleWhere
                    }
                },
                select: {
                    codigoColor: true,
                    nombreColor: true,
                    cantidadesPorTalle: true,
                    facturaItem: {
                        select: {
                            articleId: true,
                            article: {
                                select: {
                                    sku: true,
                                    description: true,
                                    supplier: { select: { id: true, code: true, name: true } }
                                }
                            }
                        }
                    }
                }
            });

            const pendingKeys = new Set<string>();
            for (const variant of usedVariants) {
                const article = variant.facturaItem.article;
                const articleId = variant.facturaItem.articleId;
                if (!article || !articleId || !hasPositiveQuantity(variant.cantidadesPorTalle)) continue;
                const colorCode = normalizeDragonfishColorCode(variant.codigoColor);
                const key = `${articleId}|${colorCode}`;
                if (mappedKeys.has(key) || pendingKeys.has(key)) continue;
                pendingKeys.add(key);
                pendingRows.push({
                    id: null,
                    status: 'pending',
                    articleId,
                    supplier: {
                        id: article.supplier.id,
                        code: article.supplier.code,
                        label: article.supplier.name
                    },
                    article: { sku: article.sku, description: article.description },
                    colorCode,
                    colorDescription: colorCode === NO_COLOR_CODE ? 'SIN COLOR' : variant.nombreColor,
                    dragonfishCode: null,
                    updatedAt: null
                });
            }
        }

        let rows = query.status === 'mapped'
            ? mappedRows
            : query.status === 'pending'
                ? pendingRows
                : [...pendingRows, ...mappedRows];

        if (query.q?.trim()) {
            const needle = query.q.trim().toLowerCase();
            rows = rows.filter((row) => [
                row.supplier.code,
                row.supplier.label,
                row.article.sku,
                row.article.description,
                row.colorCode,
                row.colorDescription,
                row.dragonfishCode || ''
            ].some((value) => value.toLowerCase().includes(needle)));
        }

        const total = rows.length;
        const start = (query.page - 1) * query.pageSize;
        return {
            items: rows.slice(start, start + query.pageSize),
            pagination: {
                page: query.page,
                pageSize: query.pageSize,
                total,
                totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize)
            }
        };
    }

    async create(payload: { articleId: string; colorCode?: string; dragonfishCode: string }) {
        await this.assertArticle(payload.articleId);
        const colorCode = normalizeDragonfishColorCode(payload.colorCode);
        const dragonfishCode = normalizeDragonfishCode(payload.dragonfishCode);
        if (!dragonfishCode) {
            throw new DragonfishEquivalenceError('VALIDATION_FAILED', 'El código Dragonfish es obligatorio', 400);
        }
        await this.assertDragonfishCodeAvailable(dragonfishCode);

        try {
            return await this.prisma.dragonfishEquivalence.create({
                data: { articleId: payload.articleId, colorCode, dragonfishCode }
            });
        } catch (error: any) {
            if (error?.code === 'P2002') {
                throw new DragonfishEquivalenceError(
                    'UNIQUE_CONSTRAINT_VIOLATION',
                    'Ya existe una equivalencia para este artículo y color',
                    409
                );
            }
            throw error;
        }
    }

    async update(id: string, dragonfishCodeValue: string) {
        const existing = await this.prisma.dragonfishEquivalence.findUnique({ where: { id } });
        if (!existing) {
            throw new DragonfishEquivalenceError('NOT_FOUND', 'Equivalencia no encontrada', 404);
        }
        const dragonfishCode = normalizeDragonfishCode(dragonfishCodeValue);
        await this.assertDragonfishCodeAvailable(dragonfishCode, id);
        return this.prisma.dragonfishEquivalence.update({
            where: { id },
            data: { dragonfishCode }
        });
    }

    async delete(id: string) {
        const existing = await this.prisma.dragonfishEquivalence.findUnique({ where: { id }, select: { id: true } });
        if (!existing) {
            throw new DragonfishEquivalenceError('NOT_FOUND', 'Equivalencia no encontrada', 404);
        }
        await this.prisma.dragonfishEquivalence.delete({ where: { id } });
    }

    buildImportTemplateWorkbook() {
        const rows = [
            [...IMPORT_HEADERS],
            ['MITRE', '70095', 'Descripción del artículo', 'N', 'Negro', 'MTIDTP70095N'],
            ['MITRE', '70090', 'Descripción del artículo', '', 'SIN COLOR', 'MTHJ70090']
        ];
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        worksheet['!cols'] = [
            { wch: 18 }, { wch: 18 }, { wch: 32 }, { wch: 14 }, { wch: 24 }, { wch: 24 }
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Equivalencias');
        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }

    async buildImportPreview(fileBuffer: Buffer, fileName: string) {
        this.cleanupPreviewStore();
        const workbook = XLSX.read(fileBuffer, { type: 'buffer', raw: false, cellText: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) {
            throw new DragonfishEquivalenceError('VALIDATION_FAILED', 'El archivo no contiene hojas', 400);
        }

        const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
        const sourceHeaders = (matrix[0] || []).map(normalizeHeader);
        const missingRequiredColumns = IMPORT_HEADERS.filter((header) => !sourceHeaders.includes(header));
        const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });

        const [suppliers, articles, colors, equivalences] = await Promise.all([
            this.prisma.supplier.findMany(),
            this.prisma.article.findMany(),
            this.prisma.supplierColor.findMany(),
            this.prisma.dragonfishEquivalence.findMany()
        ]);

        const supplierByCode = new Map(suppliers.map((supplier) => [normalizeLookup(supplier.code), supplier]));
        const articleBySupplierSku = new Map(
            articles.map((article) => [`${article.supplierId}|${normalizeLookup(article.sku)}`, article])
        );
        const colorBySupplierCode = new Map(
            colors.map((color) => [`${color.supplierId}|${normalizeLookup(color.code)}`, color])
        );
        const mappingByArticleColor = new Map(
            equivalences.map((equivalence) => [`${equivalence.articleId}|${equivalence.colorCode}`, equivalence])
        );
        const mappingByDragonfishCode = new Map(
            equivalences.map((equivalence) => [normalizeLookup(equivalence.dragonfishCode), equivalence])
        );
        const seenKeys = new Set<string>();
        const seenDragonfishCodes = new Map<string, string>();

        const rows: ImportRow[] = sourceRows.map((rawRow, index) => {
            const normalizedRaw = Object.fromEntries(
                Object.entries(rawRow).map(([key, value]) => [normalizeHeader(key), value])
            );
            const supplierCode = String(normalizedRaw.supplier_code ?? '').trim();
            const articleSku = String(normalizedRaw.article_sku ?? '').trim();
            const articleDescription = String(normalizedRaw.article_description ?? '').trim();
            const colorCode = normalizeDragonfishColorCode(normalizedRaw.color_code);
            const colorDescription = String(normalizedRaw.color_description ?? '').trim();
            const dragonfishCode = normalizeDragonfishCode(normalizedRaw.dragonfish_code);
            const warnings: string[] = [];
            const errors: string[] = [];
            const supplier = supplierByCode.get(normalizeLookup(supplierCode));
            const article = supplier
                ? articleBySupplierSku.get(`${supplier.id}|${normalizeLookup(articleSku)}`)
                : undefined;
            const color = supplier && colorCode !== NO_COLOR_CODE
                ? colorBySupplierCode.get(`${supplier.id}|${colorCode}`)
                : undefined;

            if (missingRequiredColumns.length > 0) errors.push('Faltan columnas obligatorias en el archivo');
            if (!supplierCode) errors.push('supplier_code es obligatorio');
            else if (!supplier) errors.push(`No existe el proveedor ${supplierCode}`);
            if (!articleSku) errors.push('article_sku es obligatorio');
            else if (supplier && !article) errors.push(`No existe el artículo ${articleSku} para el proveedor ${supplierCode}`);
            if (!dragonfishCode) errors.push('dragonfish_code es obligatorio');
            if (colorCode !== NO_COLOR_CODE && !color) {
                errors.push(`No existe el color ${colorCode} para el proveedor ${supplierCode}`);
            }
            if (articleDescription && article && articleDescription.toLowerCase() !== article.description.trim().toLowerCase()) {
                warnings.push(`La descripción del artículo no coincide con Stockia: ${article.description}`);
            }
            if (colorDescription && color && colorDescription.toLowerCase() !== color.value.trim().toLowerCase()) {
                warnings.push(`La descripción del color no coincide con Stockia: ${color.value}`);
            }
            if (colorCode === NO_COLOR_CODE && colorDescription && normalizeLookup(colorDescription) !== 'SIN COLOR') {
                warnings.push('El color vacío se interpretará como SIN COLOR');
            }

            const key = article ? `${article.id}|${colorCode}` : `${normalizeLookup(supplierCode)}|${normalizeLookup(articleSku)}|${colorCode}`;
            if (seenKeys.has(key)) errors.push('La combinación proveedor + artículo + color está duplicada en el archivo');
            seenKeys.add(key);
            const previousCodeKey = seenDragonfishCodes.get(dragonfishCode);
            if (dragonfishCode && previousCodeKey && previousCodeKey !== key) {
                errors.push('El código Dragonfish está repetido para otra combinación dentro del archivo');
            }
            if (dragonfishCode) seenDragonfishCodes.set(dragonfishCode, key);

            const currentMapping = article ? mappingByArticleColor.get(`${article.id}|${colorCode}`) : undefined;
            const codeOwner = mappingByDragonfishCode.get(dragonfishCode);
            if (codeOwner && (!currentMapping || codeOwner.id !== currentMapping.id)) {
                errors.push('El código Dragonfish ya está asignado a otra equivalencia');
            }

            const action = currentMapping
                ? currentMapping.dragonfishCode === dragonfishCode ? 'unchanged' as const : 'update' as const
                : 'create' as const;
            if (action === 'update') warnings.push(`Se actualizará el código actual ${currentMapping?.dragonfishCode}`);
            if (action === 'unchanged') warnings.push('La equivalencia ya existe con el mismo código');

            return {
                rowNumber: index + 2,
                supplierCode,
                articleSku,
                articleDescription: article?.description || articleDescription,
                colorCode,
                colorDescription: colorCode === NO_COLOR_CODE ? 'SIN COLOR' : color?.value || colorDescription,
                dragonfishCode,
                articleId: article?.id || null,
                warnings,
                errors,
                importable: errors.length === 0,
                action
            };
        });

        const result: ImportPreview = {
            fileName,
            missingRequiredColumns,
            rows,
            summary: {
                totalRows: rows.length,
                importableRows: rows.filter((row) => row.importable).length,
                errorRows: rows.filter((row) => row.errors.length > 0).length,
                warningRows: rows.filter((row) => row.warnings.length > 0).length,
                createRows: rows.filter((row) => row.importable && row.action === 'create').length,
                updateRows: rows.filter((row) => row.importable && row.action === 'update').length,
                unchangedRows: rows.filter((row) => row.importable && row.action === 'unchanged').length
            }
        };
        const previewId = `dragonfish_${Math.random().toString(36).slice(2, 12)}`;
        this.previewStore.set(previewId, { createdAt: Date.now(), result });
        return { previewId, result };
    }

    async commitImport(previewId: string, selectedRowNumbers?: number[]) {
        this.cleanupPreviewStore();
        const entry = this.previewStore.get(previewId);
        if (!entry) {
            throw new DragonfishEquivalenceError(
                'NOT_FOUND',
                'La previsualización venció o no existe. Volvé a cargar el archivo.',
                404
            );
        }
        const selected = selectedRowNumbers?.length ? new Set(selectedRowNumbers) : null;
        const rows = entry.result.rows.filter((row) => row.importable && (!selected || selected.has(row.rowNumber)));
        const results: Array<{ rowNumber: number; status: 'created' | 'updated' | 'unchanged' | 'rejected'; reason?: string }> = [];

        for (const row of rows) {
            if (!row.articleId) {
                results.push({ rowNumber: row.rowNumber, status: 'rejected', reason: 'Artículo no resuelto' });
                continue;
            }
            try {
                const existing = await this.prisma.dragonfishEquivalence.findUnique({
                    where: { articleId_colorCode: { articleId: row.articleId, colorCode: row.colorCode } }
                });
                if (existing?.dragonfishCode === row.dragonfishCode) {
                    results.push({ rowNumber: row.rowNumber, status: 'unchanged' });
                    continue;
                }
                await this.prisma.dragonfishEquivalence.upsert({
                    where: { articleId_colorCode: { articleId: row.articleId, colorCode: row.colorCode } },
                    create: {
                        articleId: row.articleId,
                        colorCode: row.colorCode,
                        dragonfishCode: row.dragonfishCode
                    },
                    update: { dragonfishCode: row.dragonfishCode }
                });
                results.push({ rowNumber: row.rowNumber, status: existing ? 'updated' : 'created' });
            } catch (error: any) {
                results.push({
                    rowNumber: row.rowNumber,
                    status: 'rejected',
                    reason: error?.code === 'P2002'
                        ? 'El código Dragonfish fue asignado por otra operación'
                        : 'No se pudo guardar la equivalencia'
                });
            }
        }

        return {
            previewId,
            results,
            summary: {
                requestedRows: rows.length,
                createdRows: results.filter((row) => row.status === 'created').length,
                updatedRows: results.filter((row) => row.status === 'updated').length,
                unchangedRows: results.filter((row) => row.status === 'unchanged').length,
                rejectedRows: results.filter((row) => row.status === 'rejected').length
            }
        };
    }

    async buildInvoiceExport(invoiceId: string) {
        const invoice = await this.prisma.factura.findUnique({
            where: { id: invoiceId },
            include: {
                items: {
                    include: {
                        article: { include: { supplier: true } },
                        colores: true
                    }
                }
            }
        });
        if (!invoice) {
            throw new DragonfishEquivalenceError('NOT_FOUND', 'Factura no encontrada', 404);
        }

        const articleIds = Array.from(new Set(
            invoice.items.map((item) => item.articleId).filter((value): value is string => Boolean(value))
        ));
        const mappings = await this.prisma.dragonfishEquivalence.findMany({
            where: { articleId: { in: articleIds } }
        });
        const mappingByKey = new Map(
            mappings.map((mapping) => [`${mapping.articleId}|${mapping.colorCode}`, mapping])
        );
        const missing = new Map<string, {
            articleId: string | null;
            supplierCode: string;
            supplierLabel: string;
            articleSku: string;
            articleDescription: string;
            colorCode: string;
            colorDescription: string;
        }>();
        const resolvedVariants: Array<{ dragonfishCode: string; quantities: Record<string, unknown> }> = [];

        for (const item of invoice.items) {
            for (const color of item.colores) {
                const quantities = toRecord(color.cantidadesPorTalle);
                if (!hasPositiveQuantity(quantities)) continue;
                const colorCode = normalizeDragonfishColorCode(color.codigoColor);
                const key = `${item.articleId || ''}|${colorCode}`;
                const mapping = item.articleId ? mappingByKey.get(key) : undefined;
                if (!item.articleId || !item.article || !mapping) {
                    missing.set(key, {
                        articleId: item.articleId,
                        supplierCode: item.article?.supplier.code || '',
                        supplierLabel: item.article?.supplier.name || item.marca,
                        articleSku: item.codigoArticulo,
                        articleDescription: item.article?.description || item.codigoArticulo,
                        colorCode,
                        colorDescription: colorCode === NO_COLOR_CODE ? 'SIN COLOR' : color.nombreColor
                    });
                    continue;
                }

                resolvedVariants.push({ dragonfishCode: mapping.dragonfishCode, quantities });
            }
        }

        if (missing.size > 0) {
            throw new DragonfishEquivalenceError(
                'DRAGONFISH_EQUIVALENCES_MISSING',
                'Faltan equivalencias Dragonfish para exportar la factura',
                409,
                { invoiceId, missing: Array.from(missing.values()) }
            );
        }

        const providerPart = sanitizeFileNamePart(invoice.proveedor || 'SinProveedor');
        const invoicePart = sanitizeFileNamePart(invoice.nroFactura);
        return {
            content: buildDragonfishContent(resolvedVariants),
            fileName: `${providerPart}-${formatDatePart(invoice.createdAt)}-${invoicePart}.txt`
        };
    }
}
