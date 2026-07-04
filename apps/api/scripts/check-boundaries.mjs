#!/usr/bin/env node
/**
 * 클린아키텍처 임포트 경계 가드
 *
 * 레이어별 의존성 방향 규칙을 임포트 경로 수준에서 검사합니다.
 * (architecture.md §1.4의 규칙표를 기계적으로 강제 — check-no-cast.mjs와 짝)
 *
 * 규칙:
 * 1. domain    → @nestjs/*, @/generated/*, @/common/database* 임포트 금지
 * 2. application → @/generated/*, @/common/database/prisma.types,
 *                  @/common/database/selects, 타 모듈 내부 경로 임포트 금지
 * 3. 모듈 외부  → 클린아키 모듈 내부 깊은 경로 임포트 금지
 *                (배럴 index / <module>.module 만 허용)
 *
 * 새 모듈을 클린아키텍처로 전환하면 CLEAN_MODULES에 추가하세요.
 *
 * 실행: node scripts/check-boundaries.mjs  (실패 시 exit 1)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = join(import.meta.dirname, "..");

/** 클린아키텍처 전환이 완료된 모듈 (전환 시 여기에 추가) */
const CLEAN_MODULES = ["todo"];

/** 재귀적으로 .ts 파일 수집 */
function collectTsFiles(dir) {
	const abs = join(ROOT, dir);
	let entries;
	try {
		entries = readdirSync(abs);
	} catch {
		return [];
	}
	const files = [];
	for (const entry of entries) {
		const full = join(abs, entry);
		if (statSync(full).isDirectory()) {
			files.push(...collectTsFiles(relative(ROOT, full)));
		} else if (entry.endsWith(".ts")) {
			files.push(full);
		}
	}
	return files;
}

/** 파일에서 임포트 경로 목록 추출 (import ... from "X" / export ... from "X") */
function importPathsOf(source) {
	const paths = [];
	const regex = /(?:import|export)[^"']*?from\s*["']([^"']+)["']/g;
	let match = regex.exec(source);
	while (match !== null) {
		paths.push(match[1]);
		match = regex.exec(source);
	}
	return paths;
}

const violations = [];

function check(file, importPath, rule) {
	violations.push(
		`  ${relative(ROOT, file)}\n    → "${importPath}" (${rule})`,
	);
}

for (const module of CLEAN_MODULES) {
	const base = `src/modules/${module}`;

	// 1. domain: 프레임워크·ORM·DB 접근 금지
	for (const file of collectTsFiles(`${base}/domain`)) {
		if (file.endsWith(".spec.ts")) {
			continue;
		}
		for (const p of importPathsOf(readFileSync(file, "utf8"))) {
			if (p.startsWith("@nestjs/")) {
				check(file, p, "domain → @nestjs 금지");
			}
			if (p.startsWith("@/generated/")) {
				check(file, p, "domain → generated Prisma 금지");
			}
			if (p.startsWith("@/common/database")) {
				check(file, p, "domain → database 금지");
			}
		}
	}

	// 2. application: Prisma 타입·타 모듈 내부 금지
	for (const file of collectTsFiles(`${base}/application`)) {
		if (file.endsWith(".spec.ts")) {
			continue;
		}
		for (const p of importPathsOf(readFileSync(file, "utf8"))) {
			if (p.startsWith("@/generated/")) {
				check(file, p, "application → generated Prisma 금지");
			}
			if (
				p === "@/common/database/prisma.types" ||
				p === "@/common/database/selects"
			) {
				check(file, p, "application → Prisma 구조 타입 금지 (불투명 TransactionContext 사용)");
			}
			// 타 모듈 내부 접근: 상대 경로를 해석해 다른 모듈 디렉터리로 나가는지 확인
			if (p.startsWith(".")) {
				const resolved = relative(ROOT, resolve(dirname(file), p));
				const crossModule = resolved.match(/^src\/modules\/([\w-]+)\//);
				if (crossModule && crossModule[1] !== module) {
					check(
						file,
						p,
						`application → 타 모듈(${crossModule[1]}) 내부 임포트 금지 (포트로 역전)`,
					);
				}
			}
		}
	}

	// 3. 모듈 외부에서 내부 깊은 경로 접근 금지 (배럴 index / <module>.module 만 허용)
	const allowedSuffixes = new Set([
		`src/modules/${module}`,
		`src/modules/${module}/index`,
		`src/modules/${module}/${module}.module`,
	]);
	for (const file of collectTsFiles("src")) {
		const rel = relative(ROOT, file);
		if (rel.startsWith(`src/modules/${module}/`)) {
			continue;
		}
		if (file.endsWith(".spec.ts")) {
			continue;
		}
		for (const p of importPathsOf(readFileSync(file, "utf8"))) {
			let resolved = null;
			if (p.startsWith(".")) {
				resolved = relative(ROOT, resolve(dirname(file), p));
			} else if (p.startsWith("@/")) {
				resolved = `src/${p.slice(2)}`;
			}
			if (
				resolved?.startsWith(`src/modules/${module}/`) &&
				!allowedSuffixes.has(resolved)
			) {
				check(file, p, `외부 → ${module} 모듈 내부 임포트 금지 (배럴 사용)`);
			}
		}
	}
}

if (violations.length > 0) {
	console.error("❌ 클린아키텍처 경계 위반:");
	console.error(violations.join("\n"));
	process.exit(1);
}

console.log(
	`✅ 클린아키텍처 경계: 위반 없음 (모듈: ${CLEAN_MODULES.join(", ")})`,
);
