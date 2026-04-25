import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { OPTIONAL_ARTICLE_DEFAULT_CODES } from '../src/services/articleCatalogDefaults.js';

const prisma = new PrismaClient();

const DEFAULT_DESCRIPTION = 'Not specified';

const run = async () => {
    await prisma.family.upsert({
        where: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.family },
        update: {},
        create: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.family, description: DEFAULT_DESCRIPTION }
    });

    await prisma.material.upsert({
        where: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.material },
        update: {},
        create: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.material, description: DEFAULT_DESCRIPTION }
    });

    await prisma.category.upsert({
        where: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.category },
        update: {},
        create: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.category, description: DEFAULT_DESCRIPTION }
    });

    await prisma.classification.upsert({
        where: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.classification },
        update: {},
        create: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.classification, description: DEFAULT_DESCRIPTION }
    });

    await prisma.garmentType.upsert({
        where: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.garmentType },
        update: {},
        create: { code: OPTIONAL_ARTICLE_DEFAULT_CODES.garmentType, description: DEFAULT_DESCRIPTION }
    });

    console.log('Optional article default catalogs are ready.', OPTIONAL_ARTICLE_DEFAULT_CODES);
};

run()
    .catch((error) => {
        console.error('Failed to bootstrap optional article default catalogs', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
