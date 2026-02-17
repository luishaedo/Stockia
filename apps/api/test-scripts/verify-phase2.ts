import { CreateFacturaDTO, UpdateFacturaDraftDTO } from '@stockia/shared';

const API_URL = 'http://localhost:3000';

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
    console.log('--- STARTING PHASE 2 VERIFICATION ---\n');

    // 1. Create Factura
    console.log('1. Setup: Create Base Factura');
    const validFactura: CreateFacturaDTO = {
        nroFactura: 'B-0001',
        proveedor: 'Adidas',
        items: []
    };
    const createRes = await request('POST', '/facturas', validFactura);
    if (createRes.status !== 201) throw new Error('Failed setup');
    const id = createRes.data.id;
    console.log(`Created Factura ID: ${id} ✅`);

    // 2. Duplicate Payload Check
    console.log('\n2. Duplicate Payload (Expect 400 DUPLICATE_ITEM_COLOR_IN_PAYLOAD)');
    const duplicatePayload: UpdateFacturaDraftDTO = {
        items: [
            {
                marca: 'Adidas', tipoPrenda: 'Tee', codigoArticulo: 'TEE-1', curvaTalles: ['S'],
                colores: [{ codigoColor: '001', nombreColor: 'Black', cantidadesPorTalle: { S: 1 } }]
            },
            // Same item, same color -> Duplicate in payload
            {
                marca: 'Adidas', tipoPrenda: 'Tee', codigoArticulo: 'TEE-1', curvaTalles: ['S'],
                colores: [{ codigoColor: '001', nombreColor: 'Black', cantidadesPorTalle: { S: 1 } }]
            }
        ]
    };
    const dupRes = await request('PATCH', `/facturas/${id}/draft`, duplicatePayload);
    console.log(`Status: ${dupRes.status}`, dupRes.status === 400 ? '✅' : '❌');
    console.log(`Code: ${dupRes.data.code}`, dupRes.data.code === 'DUPLICATE_ITEM_COLOR_IN_PAYLOAD' ? '✅' : '❌');

    // 3. Size Consistency Check
    console.log('\n3. Size Consistency (Expect 400 Validation Error)');
    const invalidSizePayload: UpdateFacturaDraftDTO = {
        items: [
            {
                marca: 'Adidas', tipoPrenda: 'Tee', codigoArticulo: 'TEE-1', curvaTalles: ['S', 'M'],
                colores: [{
                    codigoColor: '002',
                    nombreColor: 'White',
                    // 'XL' is not in ['S', 'M']
                    cantidadesPorTalle: { S: 1, XL: 1 }
                }]
            }
        ]
    };
    const sizeRes = await request('PATCH', `/facturas/${id}/draft`, invalidSizePayload);
    console.log(`Status: ${sizeRes.status}`, sizeRes.status === 400 ? '✅' : '❌');
    // Zod error structure check could be detailed, but status 400 is enough for high level
    const errorDetails = JSON.stringify(sizeRes.data);
    console.log(`Error contains 'must be present in curvaTalles':`, errorDetails.includes("must be present in curvaTalles") ? '✅' : '❌');

    // 4. Optimistic Locking
    console.log('\n4. Optimistic Locking (Expect 409)');
    // Get current state
    const getRes = await request('GET', `/facturas/${id}`);
    const currentUpdatedAt = getRes.data.updatedAt;

    // Try to update with OLD date
    const oldDate = new Date('2000-01-01').toISOString();
    const lockRes = await request('PATCH', `/facturas/${id}/draft`, {
        expectedUpdatedAt: oldDate,
        proveedor: "Updated Locked"
    });
    console.log(`Status: ${lockRes.status}`, lockRes.status === 409 ? '✅' : '❌');

    // Try to update with CORRECT date
    const successRes = await request('PATCH', `/facturas/${id}/draft`, {
        expectedUpdatedAt: currentUpdatedAt,
        proveedor: "Updated Success"
    });
    console.log(`Success Status: ${successRes.status}`, successRes.status === 200 ? '✅' : '❌');


    console.log('\n--- DONE ---');
}

run().catch(console.error);
