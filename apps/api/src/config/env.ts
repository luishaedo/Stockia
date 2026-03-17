import { logger } from '../lib/logger.js';

type RuntimeEnv = {
    NODE_ENV: string;
    PORT: number;
    DATABASE_URL: string;
    JWT_SECRET: string;
    AUTH_USERNAME: string;
    AUTH_PASSWORD: string;
    CORS_ALLOWED_ORIGINS: string;
    CORS_ALLOW_NO_ORIGIN: boolean;
    RATE_LIMIT_READ_MAX: number;
    RATE_LIMIT_WRITE_MAX: number;
    RATE_LIMIT_LOGIN_MAX: number;
    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
    CLOUDINARY_UPLOAD_FOLDER: string;
};

const toNumber = (raw: string | undefined, fallback: number, key: string) => {
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid ${key}: expected a positive number`);
    }
    return parsed;
};

const required = (raw: string | undefined, key: string) => {
    if (!raw || raw.trim().length === 0) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return raw;
};

const redactDatabaseUrl = (databaseUrl: string) => {
    try {
        const parsed = new URL(databaseUrl);
        if (parsed.password) parsed.password = '***';
        if (parsed.username) parsed.username = '***';
        return parsed.toString();
    } catch {
        return 'invalid-url';
    }
};

export const loadRuntimeEnv = (): RuntimeEnv => {
    const NODE_ENV = process.env.NODE_ENV ?? 'development';
    const PORT = toNumber(process.env.PORT, 4000, 'PORT');
    const DATABASE_URL = required(process.env.DATABASE_URL, 'DATABASE_URL');
    const JWT_SECRET = required(process.env.JWT_SECRET, 'JWT_SECRET');
    const AUTH_USERNAME = required(process.env.AUTH_USERNAME, 'AUTH_USERNAME');
    const AUTH_PASSWORD = required(process.env.AUTH_PASSWORD, 'AUTH_PASSWORD');

    const RATE_LIMIT_READ_MAX = toNumber(process.env.RATE_LIMIT_READ_MAX, 120, 'RATE_LIMIT_READ_MAX');
    const RATE_LIMIT_WRITE_MAX = toNumber(process.env.RATE_LIMIT_WRITE_MAX, 30, 'RATE_LIMIT_WRITE_MAX');
    const RATE_LIMIT_LOGIN_MAX = toNumber(process.env.RATE_LIMIT_LOGIN_MAX, 10, 'RATE_LIMIT_LOGIN_MAX');
    const CLOUDINARY_CLOUD_NAME = required(process.env.CLOUDINARY_CLOUD_NAME, 'CLOUDINARY_CLOUD_NAME');
    const CLOUDINARY_API_KEY = required(process.env.CLOUDINARY_API_KEY, 'CLOUDINARY_API_KEY');
    const CLOUDINARY_API_SECRET = required(process.env.CLOUDINARY_API_SECRET, 'CLOUDINARY_API_SECRET');

    return {
        NODE_ENV,
        PORT,
        DATABASE_URL,
        JWT_SECRET,
        AUTH_USERNAME,
        AUTH_PASSWORD,
        CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS ?? '',
        CORS_ALLOW_NO_ORIGIN: process.env.CORS_ALLOW_NO_ORIGIN === 'true',
        RATE_LIMIT_READ_MAX,
        RATE_LIMIT_WRITE_MAX,
        RATE_LIMIT_LOGIN_MAX,
        CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET,
        CLOUDINARY_UPLOAD_FOLDER: process.env.CLOUDINARY_UPLOAD_FOLDER ?? 'stockia/suppliers'
    };
};

export const logRuntimeEnv = (runtimeEnv: RuntimeEnv) => {
    const allowedOrigins = runtimeEnv.CORS_ALLOWED_ORIGINS
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);

    logger.info(
        {
            nodeEnv: runtimeEnv.NODE_ENV,
            port: runtimeEnv.PORT,
            databaseUrl: redactDatabaseUrl(runtimeEnv.DATABASE_URL),
            authUsername: runtimeEnv.AUTH_USERNAME,
            corsAllowedOrigins: allowedOrigins,
            corsAllowNoOrigin: runtimeEnv.CORS_ALLOW_NO_ORIGIN,
            rateLimitReadMax: runtimeEnv.RATE_LIMIT_READ_MAX,
            rateLimitWriteMax: runtimeEnv.RATE_LIMIT_WRITE_MAX,
            rateLimitLoginMax: runtimeEnv.RATE_LIMIT_LOGIN_MAX,
            cloudinaryCloudName: runtimeEnv.CLOUDINARY_CLOUD_NAME,
            cloudinaryUploadFolder: runtimeEnv.CLOUDINARY_UPLOAD_FOLDER
        },
        'Runtime environment validated'
    );
};
