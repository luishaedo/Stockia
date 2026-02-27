const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERNS = [
    /authorization/i,
    /cookie/i,
    /token/i,
    /secret/i,
    /password/i,
    /credential/i,
    /set-cookie/i,
    /api[-_]?key/i
];

const MAX_DEPTH = 6;

const isSensitiveKey = (key: string) => SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));

const redactStringValue = (value: string) => {
    const bearerPattern = /bearer\s+[a-z0-9._\-+/=]+/i;
    if (bearerPattern.test(value)) {
        return value.replace(bearerPattern, 'Bearer [REDACTED]');
    }

    if (value.length > 16 && /[a-z0-9._\-]{16,}/i.test(value)) {
        return REDACTED;
    }

    return value;
};

const sanitizeRecursive = (value: unknown, depth: number, inheritedSensitive: boolean): unknown => {
    if (depth > MAX_DEPTH) {
        return '[Truncated]';
    }

    if (value === null || value === undefined) {
        return value;
    }

    if (inheritedSensitive) {
        return REDACTED;
    }

    if (typeof value === 'string') {
        return redactStringValue(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack
        };
    }

    if (Array.isArray(value)) {
        return value.map(item => sanitizeRecursive(item, depth + 1, false));
    }

    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const sanitized: Record<string, unknown> = {};

        for (const [key, nestedValue] of Object.entries(record)) {
            const keySensitive = isSensitiveKey(key);
            sanitized[key] = sanitizeRecursive(nestedValue, depth + 1, keySensitive);
        }

        return sanitized;
    }

    return String(value);
};

export const sanitizeForLogs = <T>(value: T): T => sanitizeRecursive(value, 0, false) as T;

export const isSensitiveLogKey = (key: string) => isSensitiveKey(key);
