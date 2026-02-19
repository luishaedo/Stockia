import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';

const prisma = new PrismaClient();
const PORT = Number(process.env.PORT || 4000);

const app = createApp(prisma);

app.listen(PORT, () => {
    logger.info({ port: PORT }, `Server running on http://localhost:${PORT}`);
});
