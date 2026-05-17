import { defineConfig } from "vitest/config";
import path from "node:path";

/** 仅用于 GRAMMAR_V2_LIVE=1 的 OpenAI 验收，不纳入默认 npm test */
export default defineConfig({
  test: {
    include: ["**/*.live.test.ts"],
    testTimeout: 180_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
