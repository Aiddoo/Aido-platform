import { resolve } from "node:path";

import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

import { resolveTestDatabaseWorkerCount } from "./test/setup/test-database-workers.js";

const packageApiSource = resolve(import.meta.dirname, "../../packages/api/src");
const setupFiles = ["./test/setup/vitest.setup"];
const databaseProject = {
  globalSetup: "./test/setup/global-setup",
  setupFiles: ["./test/setup-env", ...setupFiles],
  fileParallelism: true,
  maxWorkers: resolveTestDatabaseWorkerCount(),
  sequence: { shuffle: true },
};

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: "es2022",
      },
      module: { type: "es6" },
    }),
  ],
  resolve: {
    // 접두사 일치(`@aido/api`가 `@aido/api/contracts/x`까지 삼키는 일)를 막으려고 정확히 일치하는 정규식으로 둔다.
    alias: [
      { find: "#api", replacement: resolve(import.meta.dirname, "src") },
      { find: "#test", replacement: resolve(import.meta.dirname, "test") },
      { find: /^@aido\/api$/, replacement: `${packageApiSource}/index.ts` },
      {
        find: /^@aido\/api\/(common|errors|vocabulary)$/,
        replacement: `${packageApiSource}/$1/index.ts`,
      },
      {
        find: /^@aido\/api\/contracts\/([^/]+)$/,
        replacement: `${packageApiSource}/contracts/$1/index.ts`,
      },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "lcov", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts", "src/generated/**", "src/**/*.d.ts"],
    },
    projects: [
      {
        extends: true,
        test: {
          ...databaseProject,
          name: "performance",
          fileParallelism: false,
          maxWorkers: 1,
          include: ["test/performance/**/*.performance-spec.ts"],
          testTimeout: 180_000,
        },
      },
      {
        extends: true,
        test: {
          name: "unit",
          include: [
            "src/**/*.spec.ts",
            "test/setup/**/*.spec.ts",
            "test/architecture/**/*.spec.ts",
          ],
          setupFiles,
          maxWorkers: "50%",
        },
      },
      {
        extends: true,
        test: {
          ...databaseProject,
          name: "integration",
          include: ["test/integration/**/*.integration-spec.ts"],
        },
      },
      {
        extends: true,
        test: {
          ...databaseProject,
          name: "e2e",
          include: ["test/e2e/**/*.e2e-spec.ts"],
        },
      },
    ],
  },
});
