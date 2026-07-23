import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
    buildDragonfishContent,
    DragonfishEquivalenceError,
    DragonfishEquivalenceService,
    normalizeDragonfishCode,
    normalizeDragonfishColorCode,
    NO_COLOR_CODE
} from '../src/services/dragonfishEquivalenceService.js';

assert.equal(normalizeDragonfishColorCode(''), NO_COLOR_CODE);
assert.equal(normalizeDragonfishColorCode(' n '), 'N');
assert.equal(normalizeDragonfishCode(' mtidtp70095n '), 'MTIDTP70095N');

const content = buildDragonfishContent([
    {
        dragonfishCode: 'MTHJ70090',
        quantities: { 38: 1, 40: 2, 42: 0 }
    },
    {
        dragonfishCode: 'MTIDTP70095N',
        quantities: { L: 3, XL: 0 }
    }
]);

assert.equal(
    content,
    '1+MTHJ70090!!38\n2+MTHJ70090!!40\n3+MTIDTP70095N!!L\n'
);
assert.equal(content.split('\n').filter(Boolean).length, 3);

console.log('Dragonfish equivalence verification passed.');

const invoice = {
    id: 'invoice-1',
    nroFactura: 'FAC-1',
    proveedor: 'MITRE',
    createdAt: new Date('2026-07-23T12:00:00.000Z'),
    items: [
        {
            articleId: 'article-base',
            codigoArticulo: '70090',
            marca: 'MITRE',
            article: {
                description: 'Artículo base',
                supplier: { code: 'MITRE', name: 'Mitre', id: 'supplier-1' }
            },
            colores: [
                { codigoColor: '$', nombreColor: 'SIN COLOR', cantidadesPorTalle: { 38: 1, 40: 2 } }
            ]
        },
        {
            articleId: 'article-color',
            codigoArticulo: '70095',
            marca: 'MITRE',
            article: {
                description: 'Artículo con color',
                supplier: { code: 'MITRE', name: 'Mitre', id: 'supplier-1' }
            },
            colores: [
                { codigoColor: 'N', nombreColor: 'Negro', cantidadesPorTalle: { L: 3 } }
            ]
        }
    ]
};

let mappings = [
    { articleId: 'article-base', colorCode: '$', dragonfishCode: 'MTHJ70090' },
    { articleId: 'article-color', colorCode: 'N', dragonfishCode: 'MTIDTP70095N' }
];
const fakePrisma = {
    factura: { findUnique: async () => invoice },
    dragonfishEquivalence: { findMany: async () => mappings }
} as unknown as PrismaClient;
const service = new DragonfishEquivalenceService(fakePrisma);

const verifyInvoiceExport = async () => {
    const firstExport = await service.buildInvoiceExport('invoice-1');
    assert.equal(firstExport.content, content);

    mappings = [
        { articleId: 'article-base', colorCode: '$', dragonfishCode: 'MTHJ70090' },
        { articleId: 'article-color', colorCode: 'N', dragonfishCode: 'NUEVO70095N' }
    ];
    const updatedExport = await service.buildInvoiceExport('invoice-1');
    assert.match(updatedExport.content, /3\+NUEVO70095N!!L/);

    mappings = mappings.filter((mapping) => mapping.articleId !== 'article-color');
    await assert.rejects(
        () => service.buildInvoiceExport('invoice-1'),
        (error: unknown) => error instanceof DragonfishEquivalenceError
            && error.code === 'DRAGONFISH_EQUIVALENCES_MISSING'
            && Array.isArray((error.details as { missing?: unknown[] })?.missing)
    );

    console.log('Dragonfish invoice export verification passed.');
};

void verifyInvoiceExport().catch((error) => {
    console.error(error);
    process.exit(1);
});
