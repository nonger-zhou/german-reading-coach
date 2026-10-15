import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/*.live.test.ts", "experiments/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
