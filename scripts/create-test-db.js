const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: "postgresql://postgres:admin@localhost:5432/postgres?schema=public",
      },
    },
  });

  await prisma.$connect();
  await prisma.$executeRawUnsafe("DROP DATABASE IF EXISTS lms_stage_test;");
  await prisma.$executeRawUnsafe("CREATE DATABASE lms_stage_test;");
  console.log("Database lms_stage_test created successfully.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error creating test database:", err);
  process.exit(1);
});
