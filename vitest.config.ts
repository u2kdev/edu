import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // tsconfig sets "jsx": "preserve" for Next.js. Vite 8 compiles JSX through `oxc`
  // (the old `esbuild` option is deprecated/ignored), so without this Vitest's coverage
  // remap receives untransformed JSX and the v8 AST parser drops those files
  // (false "Failed to parse ... Excluding it from coverage").
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "react",
    },
  },
  test: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    globalSetup: "./tests/global-setup.ts",
    // Test isolation in PostgreSQL with sequential execution
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL || "postgresql://postgres:admin@localhost:5432/lms_test?schema=public",
      DIRECT_URL: process.env.TEST_DATABASE_URL || "postgresql://postgres:admin@localhost:5432/lms_test?schema=public",
      TRUSTED_PROXY_HOPS: "1",
      JWT_SECRET: process.env.JWT_SECRET || "ci-dummy-jwt-secret-key-32-chars-long!"
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/types/**",
      ],
      // Fail CI on meaningful regressions. Baseline raised after the page/manager
      // UI suites landed (jsdom + Testing Library) — see reports/PROJECT_ANALYSIS.md.
      // Current baseline ~70% statements / ~71% lines, so keep a small safety margin.
      thresholds: {
        statements: 66,
        branches: 55,
        functions: 62,
        lines: 66,
      },
    },
  },
});
