import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const APPLICATION_ROOT = join(__dirname);
const FORBIDDEN_IMPORT_PREFIXES = [
	"@/auth/infrastructure/",
	"@/shared/infrastructure/",
	"@/admin-notification",
	"@/email",
];

function importPathsOf(source: string): string[] {
	const paths: string[] = [];

	for (const match of source.matchAll(/(?:import|export)[^"']*?from\s*["']([^"']+)["']/g)) {
		const path = match[1];
		if (path !== undefined) {
			paths.push(path);
		}
	}

	return paths;
}

function forbiddenImportsIn(source: string): string[] {
	return importPathsOf(source).filter((importPath) =>
		FORBIDDEN_IMPORT_PREFIXES.some((prefix) => importPath.startsWith(prefix)),
	);
}

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			return sourceFiles(path);
		}
		return entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts") ? [path] : [];
	});
}

describe("auth application boundary", () => {
	it("주석과 문자열의 경로 텍스트는 import 위반으로 보지 않는다", () => {
		const source = `
			// from "@/auth/infrastructure/example"
			const documentation = 'from "@/shared/infrastructure/example"';
		`;

		expect(forbiddenImportsIn(source)).toEqual([]);
	});

	it("실제 import와 export의 금지 경로를 따옴표 종류와 무관하게 찾는다", () => {
		const source = `
			import { adapter } from "@/auth/infrastructure/example";
			export type { Mailer } from '@/email/contracts';
		`;

		expect(forbiddenImportsIn(source)).toEqual([
			"@/auth/infrastructure/example",
			"@/email/contracts",
		]);
	});

	it("application 레이어는 infrastructure와 타 모듈 구현을 직접 import하지 않는다", () => {
		const violations = sourceFiles(APPLICATION_ROOT).flatMap((file) => {
			const source = readFileSync(file, "utf8");
			return forbiddenImportsIn(source).map(
				(pattern) => `${file.replace(`${APPLICATION_ROOT}/`, "")}: ${pattern}`,
			);
		});

		expect(violations).toEqual([]);
	});
});
