import { createHmac, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { ErrorCodes } from '@stockia/shared';
import { sendError } from './error.js';

export type AuthUser = {
    sub: string;
    role: 'admin';
};

const encode = (value: string) => Buffer.from(value).toString('base64url');
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf-8');

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export const issueAuthToken = (payload: AuthUser, jwtSecret?: string, expiresInSeconds = 8 * 60 * 60) => {
    if (!jwtSecret) {
        throw new Error('Server misconfigured: missing JWT_SECRET');
    }

    const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSeconds }));
    const signingInput = `${header}.${body}`;
    const signature = sign(signingInput, jwtSecret);

    return `${signingInput}.${signature}`;
};

const verifyAuthToken = (token: string, secret: string): AuthUser | null => {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;

    const expected = sign(`${header}.${body}`, secret);
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);

    if (left.length !== right.length || !timingSafeEqual(left, right)) {
        return null;
    }

    let parsed: { sub?: unknown; role?: unknown; exp?: unknown };
    try {
        parsed = JSON.parse(decode(body)) as { sub?: unknown; role?: unknown; exp?: unknown };
    } catch {
        return null;
    }
    if (parsed.role !== 'admin' || typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number') {
        return null;
    }

    if (parsed.exp < Math.floor(Date.now() / 1000)) {
        return null;
    }

    return {
        sub: parsed.sub,
        role: 'admin'
    };
};

export const requireAuthToken = (jwtSecret?: string) => (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return sendError(res, 401, ErrorCodes.AUTH_TOKEN_MISSING, 'Missing bearer token', undefined, req.traceId);
    }

    if (!jwtSecret) {
        return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Server misconfigured', undefined, req.traceId);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const user = verifyAuthToken(token, jwtSecret);

    if (!user) {
        return sendError(res, 403, ErrorCodes.AUTH_TOKEN_INVALID, 'Invalid authentication token', undefined, req.traceId);
    }

    req.authUser = user;
    next();
};
