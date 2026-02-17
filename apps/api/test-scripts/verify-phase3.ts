import { FacturaFilters, ErrorCodes } from '@stockia/shared';

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
    console.log('--- STARTING PHASE 3 VERIFICATION ---\n');

    // 1. Create test invoices
    console.log('1. Setup: Creating Test Invoices');
    const draft1 = await request('POST', '/facturas', {
        nroFactura: 'C-001',
        proveedor: 'Nike',
        items: [
            {
                marca: 'Nike', tipoPrenda: 'Shoe', codigoArticulo: 'SHOE-1', curvaTalles: ['39', '40'],
                colores: [{ codigoColor: '001', nombreColor: 'Black', cantidadesPorTalle: { '39': 5, '40': 10 } }]
            }
        ]
    });
    const draftId = draft1.data.id;
    console.log(`Created Draft C-001: ${draftId} ✅`);

    const draft2 = await request('POST', '/facturas', {
        nroFactura: 'C-002',
        proveedor: 'Adidas',
        items: []
    });
    console.log(`Created Draft C-002: ${draft2.data.id} ✅`);

    // 2. Test GET List with Filters & Pagination
    console.log('\n2. GET /facturas (List with Filters)');
    const listRes = await request('GET', '/facturas?estado=DRAFT&page=1&pageSize=10');
    console.log(`Status: ${listRes.status}`, listRes.status === 200 ? '✅' : '❌');
    console.log(`Has pagination: ${!!listRes.data.pagination}`, listRes.data.pagination ? '✅' : '❌');
    console.log(`Items count: ${listRes.data.items.length}`);

    // 3. Test PATCH /draft on FINAL (should return 409 INVOICE_FINAL_READ_ONLY)
    console.log('\n3. Finalize Invoice');
    const finalizeRes = await request('PATCH', `/facturas/${draftId}/finalize`);
    console.log(`Finalize Status: ${finalizeRes.status}`, finalizeRes.status === 200 ? '✅' : '❌');
    console.log(`Estado is FINAL: ${finalizeRes.data.estado === 'FINAL'}`, finalizeRes.data.estado === 'FINAL' ? '✅' : '❌');

    console.log('\n4. Attempt PATCH /draft on FINAL (Expect 409 INVOICE_FINAL_READ_ONLY)');
    const editFinalRes = await request('PATCH', `/facturas/${draftId}/draft`, {
        proveedor: 'Updated Provider'
    });
    console.log(`Status: ${editFinalRes.status}`, editFinalRes.status === 409 ? '✅' : '❌');
    console.log(`Error Code: ${editFinalRes.data.code}`, editFinalRes.data.code === ErrorCodes.INVOICE_FINAL_READ_ONLY ? '✅' : '❌');

    // 5. Test Finalize Invalid (No items)
    console.log('\n5. Finalize Empty Invoice (Expect 422 INVOICE_FINALIZE_INVALID)');
    const invalidFinalizeRes = await request('PATCH', `/facturas/${draft2.data.id}/finalize`);
    console.log(`Status: ${invalidFinalizeRes.status}`, invalidFinalizeRes.status === 422 ? '✅' : '❌');
    console.log(`Error Code: ${invalidFinalizeRes.data.code}`, invalidFinalizeRes.data.code === ErrorCodes.INVOICE_FINALIZE_INVALID ? '✅' : '❌');

    // 6. Test LIST sorting
    console.log('\n6. GET /facturas with Sorting (sortBy=nroFactura, sortDir=asc)');
    const sortedRes = await request('GET', '/facturas?sortBy=nroFactura&sortDir=asc');
    console.log(`Status: ${sortedRes.status}`, sortedRes.status === 200 ? '✅' : '❌');
    const sorted = sortedRes.data.items.map((f: any) => f.nroFactura).slice(0, 3);
    console.log(`Sorted NroFactura: ${sorted.join(', ')}`);

    console.log('\n--- DONE ---');
}

run().catch(console.error);
