import { ErrorCodes } from '@stockia/shared';

type ApiResponse<T = unknown> = {
    status: number;
    data: T;
};

const API_URL = process.env.API_URL || 'http://localhost:4000';
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'change-me';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

async function request<T = any>(
    method: string,
    path: string,
    body?: unknown,
    token?: string
): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    if (token) {
        headers.authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    return {
        status: response.status,
        data
    };
}

async function login(): Promise<string> {
    const response = await request<{ accessToken: string }>('POST', '/auth/login', {
        username: AUTH_USERNAME,
        password: AUTH_PASSWORD
    });

    assert(response.status === 200, `Expected login 200, received ${response.status}`);
    assert(response.data.accessToken, 'Missing accessToken in login response');

    return response.data.accessToken;
}

async function run() {
    console.log('--- STARTING INVOICE LIFECYCLE VERIFICATION ---\n');

    console.log('1) Auth guard: requests without token are rejected');
    const missingAuth = await request<{ error: { code: string } }>('GET', '/facturas?page=1&pageSize=1');
    assert(missingAuth.status === 401, `Expected 401 for missing token, got ${missingAuth.status}`);
    assert(
        missingAuth.data?.error?.code === ErrorCodes.AUTH_TOKEN_MISSING,
        `Expected ${ErrorCodes.AUTH_TOKEN_MISSING}, got ${missingAuth.data?.error?.code}`
    );
    console.log('   ✅ Missing token check passed');

    console.log('2) Login and get access token');
    const token = await login();
    console.log('   ✅ Login passed');

    console.log('3) Create draft invoice');
    const create = await request<any>(
        'POST',
        '/facturas',
        {
            nroFactura: `IT-${Date.now()}`,
            proveedor: 'Integration Supplier',
            items: [
                {
                    marca: 'Integration Brand',
                    tipoPrenda: 'Tee',
                    codigoArticulo: 'IT-001',
                    curvaTalles: ['S', 'M'],
                    colores: [{ codigoColor: '001', nombreColor: 'Black', cantidadesPorTalle: { S: 2, M: 3 } }]
                }
            ]
        },
        token
    );

    assert(create.status === 201, `Expected 201 on create, got ${create.status}`);
    assert(create.data.id, 'Create response is missing id');
    assert(create.data.updatedAt, 'Create response is missing updatedAt');
    console.log(`   ✅ Created draft ${create.data.id}`);

    console.log('4) Update draft with optimistic lock expectedUpdatedAt');
    const update = await request<any>(
        'PATCH',
        `/facturas/${create.data.id}/draft`,
        {
            proveedor: 'Integration Supplier Updated',
            expectedUpdatedAt: create.data.updatedAt
        },
        token
    );

    assert(update.status === 200, `Expected 200 on draft update, got ${update.status}`);
    assert(update.data.updatedAt, 'Update response is missing updatedAt');
    console.log('   ✅ Draft update passed');

    console.log('5) Verify optimistic lock rejects stale update');
    const stale = await request<{ error: { code: string } }>(
        'PATCH',
        `/facturas/${create.data.id}/draft`,
        {
            proveedor: 'Stale Update Should Fail',
            expectedUpdatedAt: create.data.updatedAt
        },
        token
    );

    assert(stale.status === 409, `Expected 409 for stale update, got ${stale.status}`);
    assert(
        stale.data?.error?.code === ErrorCodes.OPTIMISTIC_LOCK_CONFLICT,
        `Expected ${ErrorCodes.OPTIMISTIC_LOCK_CONFLICT}, got ${stale.data?.error?.code}`
    );
    console.log('   ✅ Optimistic lock check passed');

    console.log('6) Finalize invoice with latest expectedUpdatedAt');
    const finalize = await request<any>(
        'PATCH',
        `/facturas/${create.data.id}/finalize`,
        { expectedUpdatedAt: update.data.updatedAt },
        token
    );

    assert(finalize.status === 200, `Expected 200 on finalize, got ${finalize.status}`);
    assert(finalize.data.estado === 'FINAL', `Expected estado FINAL, got ${finalize.data.estado}`);
    console.log('   ✅ Finalize passed');

    console.log('\n--- INVOICE LIFECYCLE VERIFICATION COMPLETED ---');
}

run().catch((error) => {
    console.error('\n❌ INVOICE LIFECYCLE VERIFICATION FAILED');
    console.error(error);
    process.exit(1);
});
