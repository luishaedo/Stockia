import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { loadRuntimeEnv, logRuntimeEnv } from './config/env.js';

const startServer = async () => {
    const runtimeEnv = loadRuntimeEnv();
    logRuntimeEnv(runtimeEnv);

    const prisma = new PrismaClient();

    try {
        await prisma.$connect();
        logger.info({}, 'Database connection established');

        const app = createApp(prisma);

        app.listen(runtimeEnv.PORT, () => {
            logger.info({ port: runtimeEnv.PORT }, `Server running on http://localhost:${runtimeEnv.PORT}`);
        });
    } catch (error) {
        logger.error({ err: error }, 'Server startup failed');
        await prisma.$disconnect().catch(() => undefined);
        process.exit(1);
    }
};

startServer().catch(error => {
    logger.error({ err: error }, 'Fatal startup error');
    process.exit(1);
});
