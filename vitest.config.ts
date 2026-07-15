import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` throws when imported outside a React Server Component;
      // stub it so we can unit-test the pure logic in server modules.
      "server-only": r("./test/stubs/server-only.ts"),
      "@": r("./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
