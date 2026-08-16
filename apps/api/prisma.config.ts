import path from "node:path";

import { defineConfig } from "prisma/config";

import { assertDatabaseUrlIsSafe } from "./scripts/guard-database-url.cjs";

/**
 * Prisma CLI가 쓸 연결 문자열.
 *
 * 예전에는 여기서 `apps/api/.env`를 조건 없이 읽었다. 그 파일은 프로덕션 RDS를 가리키므로,
 * 빈 셸에서 `db:push`나 `db:migrate` 한 줄이면 프로덕션 스키마가 바뀌었다 — 막는 건
 * 사람의 기억뿐이었다. 이제 읽지 않는다. 실제로 이 자동 로드를 필요로 하는 경로는 없다:
 *
 * - 프로덕션 마이그레이션 컨테이너 → `.env.docker.prod`(env_file)로 주입
 * - 로컬 도커 마이그레이션·스튜디오 → `docker:dev:*` 스크립트가 인라인으로 지정
 * - CI → 워크플로 env의 placeholder
 * - `prisma generate` → 연결하지 않으므로 아래 placeholder로 충분
 *
 * 명시하지 않으면 placeholder가 되고, 연결이 필요한 명령은 그 자리에서 실패한다 —
 * 조용히 프로덕션에 붙는 것보다 낫다.
 */
const DATABASE_URL =
	process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder";

// 그래도 누군가 원격 URL을 export한 채 파괴적 명령을 칠 수 있다. 두 번째 방어선.
assertDatabaseUrlIsSafe(DATABASE_URL);

export default defineConfig({
	earlyAccess: true,
	schema: path.resolve(__dirname, "prisma/schema.prisma"),
	datasource: {
		url: DATABASE_URL,
	},
});
