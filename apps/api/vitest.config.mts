import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,

    // Learning: Tests should run from source files,
    // never from compiled production output.
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],

    // Shared MongoDB test environment is not safe for
    // concurrent test-file execution.
    fileParallelism: false,

    setupFiles: ["./src/__tests__/setup.ts"], // Tells Vitest to run the setup file before tests
  },
});
