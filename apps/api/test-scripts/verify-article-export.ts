import assert from 'node:assert/strict';
import {
    ARTICLE_EXPORT_HEADERS,
    buildArticleExportCsv,
    buildArticleExportRows
} from '../src/services/articleExportService.js';

const rows = buildArticleExportRows([
    {
        sku: '70010',
        description: 'Camisa "Premium", manga larga',
        supplier: { code: 'MITRE' },
        dragonfishEquivalences: [{ colorCode: 'N' }, { colorCode: '$' }],
        facturaItems: [{
            colores: [
                { codigoColor: 'N', nombreColor: 'Negro factura', cantidadesPorTalle: { M: 2 } },
                { codigoColor: 'R', nombreColor: 'Rojo', cantidadesPorTalle: { M: 0 } },
                { codigoColor: 'A', nombreColor: 'Azul', cantidadesPorTalle: { L: 1 } }
            ]
        }]
    },
    {
        sku: '70020',
        description: 'Artículo sin color',
        supplier: { code: 'MITRE' },
        dragonfishEquivalences: [],
        facturaItems: []
    }
], [
    { code: 'N', value: 'Negro' },
    { code: 'R', value: 'Rojo' }
]);

assert.deepEqual(rows, [
    {
        supplierCode: 'MITRE',
        articleSku: '70010',
        articleDescription: 'Camisa "Premium", manga larga',
        colorCode: '',
        colorDescription: ''
    },
    {
        supplierCode: 'MITRE',
        articleSku: '70010',
        articleDescription: 'Camisa "Premium", manga larga',
        colorCode: 'A',
        colorDescription: 'Azul'
    },
    {
        supplierCode: 'MITRE',
        articleSku: '70010',
        articleDescription: 'Camisa "Premium", manga larga',
        colorCode: 'N',
        colorDescription: 'Negro'
    },
    {
        supplierCode: 'MITRE',
        articleSku: '70020',
        articleDescription: 'Artículo sin color',
        colorCode: '',
        colorDescription: ''
    }
]);

const csv = buildArticleExportCsv(rows);
assert.equal(csv.split('\n')[0], ARTICLE_EXPORT_HEADERS.join(','));
assert.match(csv, /"Camisa ""Premium"", manga larga"/);
assert.match(csv, /"MITRE","70020","Artículo sin color","",""/);
assert.doesNotMatch(csv, /"R","Rojo"/);

console.log('Article export verification passed.');

