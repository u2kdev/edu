import { defineConfig } from "vitest/config";
import path from "path";

const integrationDbUrl =
  process.env.DATABASE_URL_TEST ||
  "postgresql://postgres:password@localhost:5433/lms_integration?schema=public";

export default defineConfig({
  test: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: "./tests/integration/global-setup.ts",
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      DATABASE_URL: integrationDbUrl,
      DIRECT_URL: integrationDbUrl,
      DATABASE_URL_TEST: integrationDbUrl,
      TRUSTED_PROXY_HOPS: "1",
      JWT_SECRET:
        process.env.JWT_SECRET || "ci-dummy-jwt-secret-key-32-chars-long!",
      PAYMENT_CONFIG_ENCRYPTION_KEY:
        process.env.PAYMENT_CONFIG_ENCRYPTION_KEY ||
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      RECEIPT_VERIFY_SECRET:
        process.env.RECEIPT_VERIFY_SECRET ||
        "fedcba9876543210fedcba9876543210fedcba9876543210",
    },
  },
});
