import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    globalSetup: "./tests/global-setup.ts",
    env: {
      DATABASE_URL: "file:./test.db"
    }
  },
});
