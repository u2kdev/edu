import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const testDbUrl = process.env.TEST_DATABASE_URL || "postgresql://postgres:admin@localhost:5432/lms_test?schema=public";
process.env.DATABASE_URL = testDbUrl;

export async function setup() {
  console.log("Setting up PostgreSQL test database...");
  const env = { ...process.env, DATABASE_URL: testDbUrl };
  execSync("node node_modules/prisma/build/index.js migrate deploy", { env, stdio: "inherit" });
}

export async function teardown() {
  console.log("Tearing down PostgreSQL test database connection...");
  const prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
  await prisma.$disconnect();
}
