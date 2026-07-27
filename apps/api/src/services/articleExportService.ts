export const ARTICLE_EXPORT_HEADERS = [
    'supplier_code',
    'article_sku',
    'article_description',
    'color_code',
    'color_description'
] as const;

type ArticleExportSource = {
    sku: string;
    description: string;
    supplier: { code: string };
    dragonfishEquivalences: Array<{ colorCode: string }>;
    facturaItems: Array<{
        colores: Array<{
            codigoColor: string;
            nombreColor: string;
            cantidadesPorTalle: unknown;
        }>;
    }>;
};

type SupplierColorSource = {
    code: string;
    value: string;
};

export type ArticleExportRow = {
    supplierCode: string;
    articleSku: string;
    articleDescription: string;
    colorCode: string;
    colorDescription: string;
};

const NO_COLOR_CODE = '$';

const normalizeColorCode = (value: unknown) => String(value ?? '').trim().toUpperCase();

const hasPositiveQuantity = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.values(value as Record<string, unknown>).some((quantity) => {
        const numericQuantity = Number(quantity);
        return Number.isFinite(numericQuantity) && numericQuantity > 0;
    });
};

export const buildArticleExportRows = (
    articles: ArticleExportSource[],
    supplierColors: SupplierColorSource[]
): ArticleExportRow[] => {
    const colorDescriptions = new Map(
        supplierColors.map((color) => [normalizeColorCode(color.code), color.value.trim()])
    );

    return [...articles]
        .sort((left, right) => left.sku.localeCompare(right.sku, 'es', { numeric: true }))
        .flatMap((article) => {
            const associatedColors = new Map<string, string>();

            const registerColor = (rawCode: unknown, rawDescription = '') => {
                const normalizedCode = normalizeColorCode(rawCode);
                const exportCode = !normalizedCode || normalizedCode === NO_COLOR_CODE ? '' : normalizedCode;
                const description = exportCode
                    ? colorDescriptions.get(normalizedCode) || rawDescription.trim() || normalizedCode
                    : '';

                if (!associatedColors.has(exportCode) || (!associatedColors.get(exportCode) && description)) {
                    associatedColors.set(exportCode, description);
                }
            };

            article.dragonfishEquivalences.forEach((equivalence) => registerColor(equivalence.colorCode));
            article.facturaItems.forEach((item) => {
                item.colores.forEach((color) => {
                    if (hasPositiveQuantity(color.cantidadesPorTalle)) {
                        registerColor(color.codigoColor, color.nombreColor);
                    }
                });
            });

            if (associatedColors.size === 0) {
                associatedColors.set('', '');
            }

            return [...associatedColors.entries()]
                .sort(([left], [right]) => left.localeCompare(right, 'es', { numeric: true }))
                .map(([colorCode, colorDescription]) => ({
                    supplierCode: article.supplier.code,
                    articleSku: article.sku,
                    articleDescription: article.description,
                    colorCode,
                    colorDescription
                }));
        });
};

const escapeCsvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

export const buildArticleExportCsv = (rows: ArticleExportRow[]) => [
    ARTICLE_EXPORT_HEADERS.join(','),
    ...rows.map((row) => [
        row.supplierCode,
        row.articleSku,
        row.articleDescription,
        row.colorCode,
        row.colorDescription
    ].map(escapeCsvCell).join(','))
].join('\n');

