"use strict";

/**
 * 파괴적 Prisma 명령이 어디로 향하는지 판단하는 문지기.
 *
 * `prisma.config.ts`는 NODE_ENV와 무관하게 `apps/api/.env`를 읽는다. 그 파일은
 * 프로덕션 RDS를 가리키므로, 빈 셸에서 `db:push`·`db:migrate`·`db:studio`를 치면
 * 그대로 프로덕션에 꽂힌다. 지금까지 이걸 막은 건 사람의 기억뿐이었다.
 *
 * 이 모듈은 Prisma CLI가 설정을 읽는 단 한 지점에서 불려, 원격 DB로 향하는 명령을
 * 기본적으로 거절한다. 원격이 정말 의도라면(프로덕션 마이그레이션 등)
 * `AIDO_ALLOW_REMOTE_DB=1`로 그 의도를 선언해야 통과한다.
 *
 * 판단 대상은 오직 "이 URL이 로컬인가"뿐이다 — 어떤 명령인지, 무엇을 바꾸는지는
 * 이 모듈의 관심사가 아니다.
 */

/** 로컬 개발·테스트가 쓰는 호스트. `db`는 docker compose 서비스명이다. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db", "host.docker.internal"]);

/** 의도를 선언하는 유일한 통로. 프로덕션 마이그레이션 경로가 이 값을 명시한다. */
const ALLOW_REMOTE_ENV = "AIDO_ALLOW_REMOTE_DB";

/**
 * 연결 문자열에서 호스트만 꺼낸다. 자격증명은 절대 밖으로 내보내지 않는다.
 *
 * @param {string} databaseUrl
 * @returns {string | null} 해석에 실패하면 null
 */
function resolveHost(databaseUrl) {
	try {
		return new URL(databaseUrl).hostname.toLowerCase();
	} catch {
		return null;
	}
}

/**
 * 로컬이 아닌 DB로 향하면 던진다.
 *
 * 해석되지 않는 URL도 거절한다 — 어디로 가는지 모르는 채 통과시키지 않는다.
 *
 * @param {string} databaseUrl
 * @param {NodeJS.ProcessEnv} [env]
 * @throws {Error} 원격이고 의도가 선언되지 않은 경우
 */
function assertDatabaseUrlIsSafe(databaseUrl, env = process.env) {
	if (env[ALLOW_REMOTE_ENV] === "1") {
		return;
	}

	const host = resolveHost(databaseUrl);
	if (host === null) {
		throw new Error(
			`[db-guard] DATABASE_URL을 해석할 수 없어 실행을 멈춘다. 어디로 향하는지 모르는 채로는 통과시키지 않는다.`,
		);
	}

	if (LOCAL_HOSTS.has(host)) {
		return;
	}

	throw new Error(
		[
			`[db-guard] 원격 데이터베이스(${host})로 향하는 Prisma 명령을 막았다.`,
			`이 셸에는 DATABASE_URL이 없어 apps/api/.env(프로덕션)가 쓰였을 가능성이 높다.`,
			``,
			`로컬에서 작업하려면 DATABASE_URL을 명시해라:`,
			`  DATABASE_URL=postgresql://postgres:postgres@localhost:5433/aido pnpm --filter @aido/api db:push`,
			``,
			`원격이 정말 의도라면 ${ALLOW_REMOTE_ENV}=1 로 선언해야 한다.`,
		].join("\n"),
	);
}

module.exports = { assertDatabaseUrlIsSafe, resolveHost, LOCAL_HOSTS, ALLOW_REMOTE_ENV };
