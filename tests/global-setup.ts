import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const testDbUrl = process.env.TEST_DATABASE_URL || "postgresql://postgres:admin@localhost:5432/lms_test?schema=public";
process.env.DATABASE_URL = testDbUrl;

export async function setup() {
  console.log("Setting up PostgreSQL test database...");
  const env = { ...process.env, DATABASE_URL: testDbUrl, DIRECT_URL: testDbUrl };
  // Reset to a clean schema so enum migrations (which validate existing rows)
  // never fail on stale data left over by earlier runs.
  execSync("node node_modules/prisma/build/index.js migrate reset --force --skip-seed", { env, stdio: "inherit" });
}

export async function teardown() {
  console.log("Tearing down PostgreSQL test database connection...");
  const prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
  await prisma.$disconnect();
}
