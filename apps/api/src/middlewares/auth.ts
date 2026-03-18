import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import { ErrorCodes } from '@stockia/shared';
import { sendError } from './error.js';

export type AuthUser = {
    userId: string;
    sub: string;
    username: string;
    role: 'admin';
    roles: string[];
    scopes: string[];
};

const JWT_ISSUER = 'stockia-api';
const JWT_AUDIENCE = 'stockia-admin';

const getJwtSecret = (secret?: string) => new TextEncoder().encode(secret);

export const issueAuthToken = async (payload: AuthUser, jwtSecret?: string, expiresInSeconds = 8 * 60 * 60) => {
    if (!jwtSecret) {
        throw new Error('Server misconfigured: missing JWT_SECRET');
    }

    const scopes = Array.from(new Set(payload.scopes)).sort().join(' ');

    return new SignJWT({
        sub: payload.sub,
        role: payload.role,
        uid: payload.userId,
        username: payload.username,
        roles: payload.roles,
        scope: scopes
    })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setJti(randomUUID())
        .setIssuedAt()
        .setExpirationTime(`${expiresInSeconds}s`)
        .sign(getJwtSecret(jwtSecret));
};

const verifyAuthToken = async (token: string, secret: string): Promise<AuthUser | null> => {
    try {
        const { payload } = await jwtVerify(token, getJwtSecret(secret), {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE
        });

        const roles = Array.isArray(payload.roles) ? payload.roles.filter((value): value is string => typeof value === 'string') : [];
        const scopes = typeof payload.scope === 'string'
            ? payload.scope.split(' ').map((value) => value.trim()).filter(Boolean)
            : [];

        if (
            payload.role !== 'admin'
            || typeof payload.sub !== 'string'
            || typeof payload.uid !== 'string'
            || typeof payload.username !== 'string'
        ) {
            return null;
        }

        return {
            userId: payload.uid,
            sub: payload.sub,
            username: payload.username,
            role: 'admin',
            roles,
            scopes
        };
    } catch {
        return null;
    }
};

export const requireAuthToken = (jwtSecret?: string) => async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return sendError(res, 401, ErrorCodes.AUTH_TOKEN_MISSING, 'Missing bearer token', undefined, req.traceId);
    }

    if (!jwtSecret) {
        return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Server misconfigured', undefined, req.traceId);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const user = await verifyAuthToken(token, jwtSecret);

    if (!user) {
        return sendError(res, 403, ErrorCodes.AUTH_TOKEN_INVALID, 'Invalid authentication token', undefined, req.traceId);
    }

    req.authUser = user;
    next();
};
