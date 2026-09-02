import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // api/ holds the serverless functions; _parse-lib.js is pure and unit
    // tested, so it has to be in scope too.
    include: ["src/**/*.test.js", "api/**/*.test.js"],
  },
});
