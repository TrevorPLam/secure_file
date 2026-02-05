import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    allowOnly: false,
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "server/**/*.ts",
        "shared/**/*.ts",
        "client/src/lib/**/*.ts",
        "client/src/hooks/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "client/src/components/ui/**",
        "server/index.ts",
        "server/static.ts",
        "server/vite.ts",
        "script/**",
      ],
      all: true,
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
        autoUpdate: false,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
});
