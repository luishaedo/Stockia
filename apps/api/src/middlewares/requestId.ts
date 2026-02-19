import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const traceId = req.header('x-trace-id') || randomUUID();
    req.traceId = traceId;
    res.setHeader('x-trace-id', traceId);
    next();
};
