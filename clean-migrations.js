const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$executeRaw`DELETE FROM _prisma_migrations WHERE migration_name != '0_init'`
  .then(() => prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations`)
  .then(console.log)
  .finally(() => prisma.$disconnect());
