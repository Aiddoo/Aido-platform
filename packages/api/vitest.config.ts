import { resolveTestWorkers } from "@aido/test-config/test-workers";
import baseConfig from "@aido/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["test/**/*.spec.ts"],
      maxWorkers: resolveTestWorkers(process.env, "25%"),
      coverage: { include: ["src/**/*.ts"] },
    },
  }),
);
