import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sanitizeForLogs } from '../src/lib/redaction.js';

const workspaceRoot = resolve(process.cwd(), '..', '..');

const filesToScan = [
    'src/middlewares/requestLogger.ts',
    'src/middlewares/error.ts',
    'src/lib/logger.ts',
    'src/controllers/facturaController.ts',
    'src/index.ts',
    'src/app.ts',
    'test-scripts/smoke-ci.sh',
    '../../render.yaml',
    '../../.github/workflows/ci.yml'
];

const bannedLoggingPatterns = [
    /logger\.(info|warn|error|debug)\s*\(\s*\{[^}]*authorization\s*:/i,
    /logger\.(info|warn|error|debug)\s*\(\s*\{[^}]*cookie\s*:/i,
    /console\.(log|warn|error)\(.*authorization/i,
    /console\.(log|warn|error)\(.*cookie/i,
    /console\.(log|warn|error)\(.*token/i
];

const assert = (condition: unknown, message: string) => {
    if (!condition) {
        throw new Error(message);
    }
};

const verifySanitizer = () => {
    const sanitized = sanitizeForLogs({
        headers: {
            Authorization: 'Bearer abc.def.ghi',
            cookie: 'sid=123',
            'x-request-id': 'trace-1'
        },
        token: 'top-secret-token',
        nested: {
            password: 'unsafe'
        },
        message: 'Authorization: Bearer abcdefghijklmnop'
    });

    const serialized = JSON.stringify(sanitized);

    assert(serialized.includes('[REDACTED]'), 'Sanitizer must redact sensitive values');
    assert(!serialized.includes('top-secret-token'), 'Token value must not appear in sanitized output');
    assert(!serialized.includes('sid=123'), 'Cookie value must not appear in sanitized output');
    assert(!serialized.includes('unsafe'), 'Password value must not appear in sanitized output');
};

const verifyStaticPatterns = () => {
    for (const relativePath of filesToScan) {
        const absolutePath = resolve(process.cwd(), relativePath);
        const content = readFileSync(absolutePath, 'utf8');

        for (const pattern of bannedLoggingPatterns) {
            if (pattern.test(content)) {
                throw new Error(`Forbidden logging pattern detected in ${relativePath}: ${pattern}`);
            }
        }
    }

    const workflowContent = readFileSync(resolve(workspaceRoot, '.github/workflows/ci.yml'), 'utf8');
    assert(workflowContent.includes('verify:log-policy'), 'CI must run verify:log-policy');
};

try {
    verifySanitizer();
    verifyStaticPatterns();
    console.log('Log policy verification passed.');
} catch (error) {
    console.error('Log policy verification failed.');
    console.error(error);
    process.exit(1);
}
