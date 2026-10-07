import { resolve } from "node:path";

import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

const setupFiles = ["./test/setup/vitest.setup.ts"];
const databaseProject = {
	globalSetup: "./test/setup/global-setup.ts",
	setupFiles: ["./test/setup-env.ts", ...setupFiles],
	fileParallelism: false,
	maxWorkers: 1,
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
		alias: {
			"#api": resolve(import.meta.dirname, "src"),
			"#test": resolve(import.meta.dirname, "test"),
			"@aido/errors": resolve(import.meta.dirname, "../../packages/errors/src/index.ts"),
			"@aido/validators": resolve(import.meta.dirname, "../../packages/validators/src/index.ts"),
		},
	},
	test: {
		globals: true,
		environment: "node",
		clearMocks: true,
		restoreMocks: true,
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
					include: ["test/performance/**/*.performance-spec.ts"],
					testTimeout: 180_000,
				},
			},
			{
				extends: true,
				test: {
					name: "unit",
					include: ["src/**/*.spec.ts", "test/setup/**/*.spec.ts"],
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
