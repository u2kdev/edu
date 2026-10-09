import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    globalSetup: "./tests/global-setup.ts",
    // Test isolation in PostgreSQL with sequential execution
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL || "postgresql://postgres:admin@localhost:5432/lms_test?schema=public",
      TRUSTED_PROXY_HOPS: "1"
    }
  },
});
