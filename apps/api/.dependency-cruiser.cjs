/**
 * 클린아키텍처 임포트 경계 (architecture.md §1.4의 기계적 강제)
 *
 * scripts/check-boundaries.mjs(regex 기반)를 대체 — 경로 해석 기반이라
 * 상대/alias 임포트를 동일하게 판정하고, 모듈 목록 하드코딩 없이
 * src/<module>/ 구조에서 자동 유도된다 (shared·generated만 비모듈).
 *
 * 실행: pnpm lint:boundaries  (CI: lint:arch 태스크)
 */

/** 배럴 외 허용되는 공개 서브엔트리 (사유는 각 파일 헤더 참조) */
const PUBLIC_SUBENTRIES = [
	"^src/notification/queue\\.ts$", // enqueue 전용 경량 심 — heavy 배럴 순환 절단
	"^src/scheduler/queue\\.ts$",
	"^src/auth/presentation/decorators/index\\.ts$", // @CurrentUser·@Public·@Admin 경량 공개 표면
];

/** 모듈 배럴: src/<m>/index.ts 와 src/<m>/<m>.module.ts */
const MODULE_BARRELS = [
	"^src/[^/]+/index\\.ts$",
	"^src/([^/]+)/\\1\\.module\\.ts$",
];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		// ── 1. domain: 프레임워크·ORM·포트 정의 접근 금지 ──────────────────
		{
			name: "domain-no-nestjs",
			comment: "domain → @nestjs 금지",
			severity: "error",
			from: { path: "^src/[^/]+/domain/", pathNot: "\\.spec\\.ts$" },
			to: { path: "(^|/)@nestjs/" },
		},
		{
			name: "domain-no-generated-prisma",
			comment: "domain → generated Prisma 금지",
			severity: "error",
			from: { path: "^src/[^/]+/domain/", pathNot: "\\.spec\\.ts$" },
			to: { path: "^src/generated/" },
		},
		{
			name: "domain-no-shared-ports",
			comment: "domain → shared application ports 금지",
			severity: "error",
			from: { path: "^src/[^/]+/domain/", pathNot: "\\.spec\\.ts$" },
			to: { path: "^src/shared/application/ports" },
		},

		// ── 2. application: 구현 접근 금지 (포트로 역전) ───────────────────
		// (shared/application은 크로스커팅 계층이라 모듈 application 규칙의 대상이 아님)
		{
			name: "application-no-own-infra",
			comment: "application → 자체 infrastructure 구현 금지 (포트로 역전)",
			severity: "error",
			from: { path: "^src/(?!shared/)([^/]+)/application/", pathNot: "\\.spec\\.ts$" },
			to: { path: "^src/$1/infrastructure/" },
		},
		{
			name: "application-no-generated-prisma",
			comment: "application → generated Prisma 금지",
			severity: "error",
			from: { path: "^src/(?!shared/)[^/]+/application/", pathNot: "\\.spec\\.ts$" },
			to: { path: "^src/generated/" },
		},
		{
			name: "application-no-prisma-structural-types",
			comment: "application → Prisma 구조 타입 금지 (불투명 TransactionContext 사용)",
			severity: "error",
			from: { path: "^src/(?!shared/)[^/]+/application/", pathNot: "\\.spec\\.ts$" },
			to: {
				path: "^src/shared/infrastructure/database/(prisma\\.types|selects)(\\.ts)?$",
			},
		},
		{
			name: "auth-application-ports-only",
			comment:
				"auth application → 구현/타 모듈 직접 의존 금지 (인증·세션은 장기 안정 경계 — 포트 사용)",
			severity: "error",
			from: { path: "^src/auth/application/", pathNot: "\\.spec\\.ts$" },
			to: { path: "^src/(shared/infrastructure/|admin-notification|email)" },
		},

		// ── 3. 모듈 외부 → 내부 깊은 경로 금지 (배럴·공개 서브엔트리만) ────────
		{
			name: "module-barrel-only",
			comment: "모듈 외부 → 모듈 내부 임포트 금지 (배럴 사용)",
			severity: "error",
			from: { path: "^src/([^/]+)/", pathNot: "\\.spec\\.ts$" },
			to: {
				path: "^src/(?!shared/|generated/)[^/]+/.+",
				pathNot: ["^src/$1/", ...MODULE_BARRELS, ...PUBLIC_SUBENTRIES],
			},
		},
		{
			name: "root-barrel-only",
			comment: "src 루트(main·app.module 등) → 모듈 내부 임포트 금지 (배럴 사용)",
			severity: "error",
			from: { path: "^src/[^/]+\\.ts$", pathNot: "\\.spec\\.ts$" },
			to: {
				path: "^src/(?!shared/|generated/)[^/]+/.+",
				pathNot: [...MODULE_BARRELS, ...PUBLIC_SUBENTRIES],
			},
		},
	],
	options: {
		doNotFollow: { path: "node_modules" },
		tsConfig: { fileName: "tsconfig.json" },
		tsPreCompilationDeps: true,
		// 내부 캐시 미사용 — 설정 변경 시 캐시 무효화가 불완전해 낡은 판정 위험.
		// 캐싱은 turbo 태스크(inputs 기반)가 담당한다.
	},
};
