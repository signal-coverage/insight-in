import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run in node by default; component tests opt into jsdom with a per-file
// `// @vitest-environment jsdom` docblock.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", ".heroui-docs/**"],
  },
});
