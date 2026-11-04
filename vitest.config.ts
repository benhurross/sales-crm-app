import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["tests/**/*.test.tsx"],
          setupFiles: ["./tests/helpers/setup-dom.ts"],
        },
      },
      {
        extends: true,
        test: { name: "node", environment: "node", include: ["tests/**/*.test.ts"], testTimeout: 30_000 },
      },
    ],
    coverage: {
      include: ["src/lib/**", "src/server/**"],
      exclude: ["src/server/db/**", "src/lib/auth-client.ts"],
      reporter: ["text", "html"],
    },
  },
});
