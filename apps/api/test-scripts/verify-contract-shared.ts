import {
    AdminInvoiceListResponseSchema,
    AdminInvoiceUsersResponseSchema,
    CreateFacturaSchema,
    ErrorCodes,
    OperationCatalogsResponseSchema
} from '@stockia/shared';

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
    console.log('--- STARTING SHARED CONTRACT VERIFICATION ---\n');

    console.log('1) Unauthorized contract check (missing bearer token)');
    const unauthorized = await request<{ error: { code: string } }>('GET', '/admin/invoices?page=1&pageSize=1');
    assert(unauthorized.status === 401, `Expected 401, got ${unauthorized.status}`);
    assert(
        unauthorized.data?.error?.code === ErrorCodes.AUTH_TOKEN_MISSING,
        `Expected ${ErrorCodes.AUTH_TOKEN_MISSING}, got ${unauthorized.data?.error?.code}`
    );
    console.log('   ✅ Unauthorized contract check passed');

    console.log('2) Login');
    const token = await login();
    console.log('   ✅ Login passed');

    console.log('3) Create fixture invoice using shared request schema');
    const fixturePayload = {
        nroFactura: `CT-${Date.now()}`,
        proveedor: 'Contract Supplier',
        items: []
    };
    const parsedCreate = CreateFacturaSchema.safeParse(fixturePayload);
    assert(parsedCreate.success, 'Fixture payload does not satisfy CreateFacturaSchema');

    const create = await request<any>('POST', '/facturas', fixturePayload, token);
    assert(create.status === 201, `Expected 201 on fixture create, got ${create.status}`);
    console.log('   ✅ Fixture invoice created');

    console.log('4) Validate /admin/invoices response with shared schema');
    const adminInvoices = await request('GET', '/admin/invoices?page=1&pageSize=20', undefined, token);
    assert(adminInvoices.status === 200, `Expected 200 on /admin/invoices, got ${adminInvoices.status}`);
    const parsedInvoices = AdminInvoiceListResponseSchema.safeParse(adminInvoices.data);
    assert(parsedInvoices.success, 'Response does not satisfy AdminInvoiceListResponseSchema');
    console.log('   ✅ /admin/invoices contract passed');

    console.log('5) Validate /admin/invoice-users response with shared schema');
    const invoiceUsers = await request('GET', '/admin/invoice-users?page=1&pageSize=20', undefined, token);
    assert(invoiceUsers.status === 200, `Expected 200 on /admin/invoice-users, got ${invoiceUsers.status}`);
    const parsedUsers = AdminInvoiceUsersResponseSchema.safeParse(invoiceUsers.data);
    assert(parsedUsers.success, 'Response does not satisfy AdminInvoiceUsersResponseSchema');
    console.log('   ✅ /admin/invoice-users contract passed');

    console.log('6) Validate /operations/catalogs response with shared schema');
    const operationCatalogs = await request('GET', '/operations/catalogs', undefined, token);
    assert(operationCatalogs.status === 200, `Expected 200 on /operations/catalogs, got ${operationCatalogs.status}`);
    const parsedCatalogs = OperationCatalogsResponseSchema.safeParse(operationCatalogs.data);
    assert(parsedCatalogs.success, 'Response does not satisfy OperationCatalogsResponseSchema');
    console.log('   ✅ /operations/catalogs contract passed');

    console.log('\n--- SHARED CONTRACT VERIFICATION COMPLETED ---');
}

run().catch((error) => {
    console.error('\n❌ SHARED CONTRACT VERIFICATION FAILED');
    console.error(error);
    process.exit(1);
});
