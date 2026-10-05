const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations`.then(console.log).finally(() => prisma.$disconnect());
