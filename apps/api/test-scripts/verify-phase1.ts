import { CreateFacturaDTO, UpdateFacturaDraftDTO } from '@stockia/shared';

const API_URL = process.env.API_URL || 'http://localhost:4000';

async function request(method: string, path: string, body?: any) {
    const headers = { 'Content-Type': 'application/json' };
    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: JSON.stringify(body)
    });
    const data = await res.json();
    return { status: res.status, data };
}

async function run() {
    console.log('--- STARTING VERIFICATION ---\n');

    // 1. Create Valid Factura
    console.log('1. POST /facturas (Valid)');
    const validFactura: CreateFacturaDTO = {
        nroFactura: 'A-0001',
        proveedor: 'Test Provider',
        items: [
            {
                marca: 'Nike',
                tipoPrenda: 'Remera',
                codigoArticulo: 'REM-001',
                curvaTalles: ['S', 'M', 'L'],
                colores: [
                    { codigoColor: 'RED', nombreColor: 'Red', cantidadesPorTalle: { S: 10, M: 5 } }
                ]
            }
        ]
    };
    const createRes = await request('POST', '/facturas', validFactura);
    console.log(`Status: ${createRes.status}`, createRes.status === 201 ? '✅' : '❌');
    const facturaId = createRes.data.id;
    if (!facturaId) throw new Error('Failed to create factura');

    // 2. Duplicate Payload (Should fail)
    console.log('\n2. POST /facturas (Duplicate Payload -> Expect 400)');
    const duplicateFactura: CreateFacturaDTO = {
        nroFactura: 'A-0002',
        items: [
            {
                marca: 'Nike', tipoPrenda: 'Remera', codigoArticulo: 'REM-001', curvaTalles: ['S'],
                colores: [{ codigoColor: 'RED', nombreColor: 'Red', cantidadesPorTalle: { S: 1 } }]
            },
            {
                marca: 'Nike', tipoPrenda: 'Remera', codigoArticulo: 'REM-001', curvaTalles: ['S'],
                colores: [{ codigoColor: 'RED', nombreColor: 'Red', cantidadesPorTalle: { S: 1 } }]
            }
        ]
    };
    const dupRes = await request('POST', '/facturas', duplicateFactura);
    console.log(`Status: ${dupRes.status} Code: ${dupRes.data.code}`, dupRes.status === 400 ? '✅' : '❌');

    // 3. GET Factura
    console.log('\n3. GET /facturas/:id');
    const getRes = await request('GET', `/facturas/${facturaId}`);
    console.log('Retrieved ID:', getRes.data.id, getRes.status === 200 ? '✅' : '❌');

    // 4. PATCH Draft with Merge (SUM)
    console.log('\n4. PATCH /facturas/:id/draft (SUM Duplicate)');
    const patchData: UpdateFacturaDraftDTO = {
        duplicateHandler: 'SUM',
        items: [
            {
                marca: 'Nike', tipoPrenda: 'Remera', codigoArticulo: 'REM-001', curvaTalles: ['S', 'M', 'L'],
                colores: [{ codigoColor: 'RED', nombreColor: 'Red', cantidadesPorTalle: { S: 5 } }] // Original had 10 -> Expect 15? No, Replace All then Merge within payload?
                // Wait, Logic is: We send the FULL list. If the LIST has duplicates, we merge them.
                // We do NOT merge with DB state (Draft = Full Replace).
                // So let's send a list with duplicates to test the Handler.
            },
            {
                marca: 'Nike', tipoPrenda: 'Remera', codigoArticulo: 'REM-001', curvaTalles: ['S', 'M', 'L'],
                colores: [{ codigoColor: 'RED', nombreColor: 'Red', cantidadesPorTalle: { S: 5 } }]
            }
        ]
    };
    // S: 5 + S: 5 = S: 10
    const patchRes = await request('PATCH', `/facturas/${facturaId}/draft`, patchData);
    const item = patchRes.data.items[0];
    const color = item.colores[0];
    const qty = color.cantidadesPorTalle['S'];
    console.log(`Merged Quantity: ${qty}`, qty === 10 ? '✅' : '❌');

    // 5. Optimistic Locking
    console.log('\n5. Optimistic Locking (Expect 409)');
    const oldDate = new Date('2000-01-01').toISOString();
    const lockRes = await request('PATCH', `/facturas/${facturaId}/draft`, {
        ...patchData,
        expectedUpdatedAt: oldDate
    });
    console.log(`Status: ${lockRes.status}`, lockRes.status === 409 ? '✅' : '❌');

    console.log('\n--- DONE ---');
}

run().catch(console.error);
