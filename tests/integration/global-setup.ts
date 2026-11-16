import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const integrationDbUrl =
  process.env.DATABASE_URL_TEST ||
  "postgresql://postgres:password@localhost:5433/lms_integration?schema=public";

process.env.DATABASE_URL = integrationDbUrl;
process.env.DIRECT_URL = integrationDbUrl;

export async function setup() {
  console.log("[integration] Resetting & migrating PostgreSQL test database...");
  const env = {
    ...process.env,
    DATABASE_URL: integrationDbUrl,
    DIRECT_URL: integrationDbUrl,
  };
  execSync(
    "node node_modules/prisma/build/index.js migrate reset --force --skip-seed",
    { env, stdio: "inherit" }
  );
}

export async function teardown() {
  const prisma = new PrismaClient({
    datasources: { db: { url: integrationDbUrl } },
  });
  await prisma.$disconnect();
}
