#!/usr/bin/env node
/**
 * 클린아키텍처 영역 타입 안전성 가드
 *
 * 아래 대상에서 `as` 타입 단언과 `!` non-null 단언을 금지합니다.
 * Biome에는 전역 no-assertion 규칙이 없어(noNonNullAssertion만 존재) 이 스크립트로 `as`를 보완합니다.
 * (import 별칭 `X as Y`, `as const`는 허용)
 *
 * 대상:
 * - src/(*)/{domain,application,infrastructure}/** (spec 포함 — 마이그레이션된 코드 + 신규 테스트)
 * - src/shared/domain/**
 *
 * 제외: 프롬프트 템플릿 디렉터리(`/prompts/`, `/prompt/`). LLM 시스템 프롬프트는
 *      자연어 산문("as values", "as is", "interpret as" 등)이 많아 라인 기반 `as`
 *      휴리스틱이 대량 오탐한다. 프롬프트는 로직이 아닌 텍스트 데이터이므로 제외한다.
 *
 * 실행: node scripts/check-no-cast.mjs  (실패 시 exit 1)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const TARGET_DIRS = [
	"src/shared/domain",
	"src/todo/domain",
	"src/todo/application",
	"src/todo/infrastructure",
	"src/inquiry/domain",
	"src/inquiry/application",
	"src/inquiry/infrastructure",
	"src/admin/domain",
	"src/admin/application",
	"src/admin/infrastructure",
	"src/daily-completion/domain",
	"src/daily-completion/application",
	"src/daily-completion/infrastructure",
	"src/weekly-achievement/domain",
	"src/weekly-achievement/application",
	"src/weekly-achievement/infrastructure",
	"src/email/domain",
	"src/email/application",
	"src/email/infrastructure",
	"src/weather/domain",
	"src/weather/application",
	"src/weather/infrastructure",
	"src/ai/domain",
	"src/ai/application",
	"src/ai/infrastructure",
	"src/memo/domain",
	"src/memo/application",
	"src/memo/infrastructure",
	"src/follow/domain",
	"src/follow/application",
	"src/follow/infrastructure",
	"src/cheer/domain",
	"src/cheer/application",
	"src/cheer/infrastructure",
	"src/nudge/domain",
	"src/nudge/application",
	"src/nudge/infrastructure",
	"src/todo-category/domain",
	"src/todo-category/application",
	"src/todo-category/infrastructure",
	"src/ai-suggestion/domain",
	"src/ai-suggestion/application",
	"src/ai-suggestion/infrastructure",
	"src/subscription/domain",
	"src/subscription/application",
	"src/subscription/infrastructure",
	"src/ai-report/domain",
	"src/ai-report/application",
	"src/ai-report/infrastructure",
	"src/admin-notification/domain",
	"src/admin-notification/application",
	"src/admin-notification/infrastructure",
	"src/user-settings/domain",
	"src/user-settings/application",
	"src/user-settings/infrastructure",
	"src/notification/domain",
	"src/notification/application",
	"src/notification/infrastructure",
	"src/scheduler/domain",
	"src/scheduler/application",
	"src/scheduler/infrastructure",
];

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

// `as` 타입 단언: `as Type` / `as {` / `as (` / `as unknown` — `as const`와 import/export 별칭 제외
const AS_ASSERTION = /\bas\s+(?!const\b)[A-Za-z_{(]/;
// non-null 단언: 식별자/`)`/`]` 뒤의 `!`, 단 `!=`(비교)는 제외
const NON_NULL = /[A-Za-z0-9_)\]]!(?![=])/;

const violations = [];

/**
 * 산문(자연어) 데이터 파일은 스캔에서 제외한다.
 * - `/prompts/`, `/prompt/`: LLM 시스템 프롬프트
 * - `/templates/`: 알림 메시지 i18n 템플릿(byte-identical 문구). "as"/"!"가 포함된
 *   사용자 대상 문구가 많아 라인 기반 휴리스틱이 대량 오탐한다. 로직이 아닌 텍스트 데이터.
 */
const isPromptFile = (file) =>
	file.includes("/prompts/") ||
	file.includes("/prompt/") ||
	file.includes("/templates/");

for (const dir of TARGET_DIRS) {
	for (const file of collectTsFiles(dir)) {
		if (isPromptFile(file)) {
			continue;
		}
		const lines = readFileSync(file, "utf8").split("\n");
		lines.forEach((line, idx) => {
			// 한 줄 주석 제거 후 검사 — 주석 속 영단어 `as`/`!`(예: `// as a result`, `// Don't!`) 오탐 방지
			const code = line.replace(/\/\/.*$/, "");
			const trimmed = code.trim();
			if (!trimmed) return;
			const isImportLike =
				trimmed.startsWith("import ") ||
				trimmed.startsWith("export ") ||
				trimmed.startsWith("} from") ||
				code.includes(" from ");
			if (!isImportLike && AS_ASSERTION.test(code)) {
				violations.push(`${relative(ROOT, file)}:${idx + 1}\t[as] ${line.trim()}`);
			}
			if (NON_NULL.test(code)) {
				violations.push(`${relative(ROOT, file)}:${idx + 1}\t[!]  ${line.trim()}`);
			}
		});
	}
}

if (violations.length > 0) {
	console.error(
		`\n❌ 클린아키텍처 영역에서 타입 단언(as)/non-null(!) ${violations.length}건 발견:\n`,
	);
	for (const v of violations) {
		console.error(`  ${v}`);
	}
	console.error(
		"\n타입 단언 없이 정합되도록 수정하세요 (import 별칭·as const는 허용).\n",
	);
	process.exit(1);
}

console.log("✅ 클린아키텍처 영역: as/non-null 단언 없음 (타입세이프 100%)");
