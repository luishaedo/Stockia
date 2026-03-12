import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import { ArticleImportService } from '../src/services/articleImportService.js';

const buildWorkbookBuffer = (rows: Array<Record<string, string>>) => {
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
};

const mockPrisma = {
    supplier: { findMany: async () => [{ id: 'sup-1', code: '0001', name: 'Supplier A' }] },
    family: { findMany: async () => [{ id: 'fam-1', code: '01', description: 'Family A' }] },
    material: { findMany: async () => [{ id: 'mat-1', code: '10', description: 'Cotton' }] },
    category: { findMany: async () => [{ id: 'cat-1', code: '20', description: 'Category A' }] },
    classification: { findMany: async () => [{ id: 'cls-1', code: '30', description: 'Class A' }] },
    garmentType: { findMany: async () => [{ id: 'gar-1', code: '40', description: 'T-Shirt' }] },
    sizeCurve: { findMany: async () => [{ id: 'siz-1', code: '50', description: 'Curve A' }] },
    article: {
        findMany: async () => [],
        create: async () => ({ id: 'a1' })
    },
    $transaction: async (fn: (tx: any) => Promise<void>) => fn(mockPrisma)
} as any;

const run = async () => {
    const service = new ArticleImportService(mockPrisma);

    // malformed file -> should produce non-importable preview
    const malformedPreview = await service.buildPreview(Buffer.from('not-an-excel'), 'bad.xlsx');
    assert.ok(malformedPreview.result.summary.importableRows === 0);

    // missing required columns
    const missingColsBuffer = buildWorkbookBuffer([{ sku: '001', description: 'X' }]);
    const missingCols = await service.buildPreview(missingColsBuffer, 'missing.xlsx');
    assert.ok(missingCols.result.missingRequiredColumns.length > 0);

    // missing catalogs
    const missingCatalogBuffer = buildWorkbookBuffer([
        { sku: '0001', description: 'Desc', supplier_code: '9999', family_code: '01', material_code: '10', category_code: '20', classification_code: '30', garment_type_code: '40', size_curve_code: '50' }
    ]);
    const missingCatalogPreview = await service.buildPreview(missingCatalogBuffer, 'missing-catalog.xlsx');
    assert.equal(missingCatalogPreview.result.rows[0].importable, false);

    // duplicate SKU inside file
    const duplicateBuffer = buildWorkbookBuffer([
        { sku: '0001', description: 'Desc', supplier_code: '0001', family_code: '01', material_code: '10', category_code: '20', classification_code: '30', garment_type_code: '40', size_curve_code: '50' },
        { sku: '0001', description: 'Desc2', supplier_code: '0001', family_code: '01', material_code: '10', category_code: '20', classification_code: '30', garment_type_code: '40', size_curve_code: '50' }
    ]);
    const duplicatePreview = await service.buildPreview(duplicateBuffer, 'dup.xlsx');
    assert.equal(duplicatePreview.result.rows[0].duplicateInFile, true);

    // dry-run successful preview
    const okBuffer = buildWorkbookBuffer([
        { sku: '0002', description: 'Desc', supplier_code: '0001', family_code: '01', material_code: '10', category_code: '20', classification_code: '30', garment_type_code: '40', size_curve_code: '50' }
    ]);
    const okPreview = await service.buildPreview(okBuffer, 'ok.xlsx');
    assert.equal(okPreview.result.rows[0].importable, true);

    // successful import commit
    const commit = await service.commitPreview(okPreview.previewId!, [okPreview.result.rows[0].rowNumber]);
    assert.equal(commit.summary.importedRows, 1);

    console.log('verify-article-import passed');
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
