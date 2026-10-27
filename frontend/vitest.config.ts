import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["app/**/*.{ts,tsx}"],
      exclude: [
        "app/**/*.d.ts",
        "app/**/*.test.{ts,tsx}",
        "app/**/*.spec.{ts,tsx}",
        "app/entry.client.tsx",
        "app/entry.server.tsx",
        "app/root.tsx",
        "app/routes.ts",
        "app/routes/**",
        "app/components/ui/**",
        "app/lib/utils.ts",
        "app/lib/use-*.ts",
      ],
    },
  },
});
