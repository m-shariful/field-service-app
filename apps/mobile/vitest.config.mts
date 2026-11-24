import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(currentDirectory, "./src"),
    },
  },

  test: {
    environment: "node",

    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
