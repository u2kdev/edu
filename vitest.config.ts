import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    globalSetup: "./tests/global-setup.ts",
    // Обоснование: SQLite БД (test.db) одна на все тесты. Параллельное выполнение вызывает гонки при удалении и ошибку Foreign Key Violation.
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./test.db"
    }
  },
});
