import type { AuthUser } from '../middlewares/auth.js';

declare global {
    namespace Express {
        interface Request {
            traceId?: string;
            authUser?: AuthUser;
        }
    }
}

export {};
