import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export async function setup() {
  console.log("Creating test.db and pushing schema...");
  const env = { ...process.env, DATABASE_URL: "file:./test.db" };
  execSync("npx prisma db push --skip-generate --accept-data-loss", { env, stdio: "inherit" });
}

export async function teardown() {
  const dbPath = path.join(process.cwd(), "prisma", "test.db");
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log("Cleaned up test.db");
  }
}
