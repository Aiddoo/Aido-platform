import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const APPLICATION_ROOT = join(__dirname);
const FORBIDDEN_IMPORTS = [
	'from "@/auth/infrastructure/',
	'from "@/shared/infrastructure/',
	'from "@/admin-notification',
	'from "@/email',
];

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			return sourceFiles(path);
		}
		return entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")
			? [path]
			: [];
	});
}

describe("auth application boundary", () => {
	it("application 레이어는 infrastructure와 타 모듈 구현을 직접 import하지 않는다", () => {
		const violations = sourceFiles(APPLICATION_ROOT).flatMap((file) => {
			const source = readFileSync(file, "utf8");
			return FORBIDDEN_IMPORTS.filter((pattern) =>
				source.includes(pattern),
			).map(
				(pattern) => `${file.replace(`${APPLICATION_ROOT}/`, "")}: ${pattern}`,
			);
		});

		expect(violations).toEqual([]);
	});
});
