// web/vitest.config.mts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setupTests.ts"],
    css: true,
    coverage: { reporter: ["text", "html"], reportsDirectory: "./coverage" },
    testTimeout: 15000,
    pool: "forks", // 👈 importante para evitar el error de TextEncoder/Uint8Array
  },
});
