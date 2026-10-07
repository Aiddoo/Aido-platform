"use strict";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db", "host.docker.internal"]);
const ALLOW_REMOTE_ENV = "AIDO_ALLOW_REMOTE_DB";

/** @param {string} databaseUrl @returns {string | null} */
function resolveHost(databaseUrl) {
  try {
    return new URL(databaseUrl).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return null;
  }
}

/** @param {string} databaseUrl @param {NodeJS.ProcessEnv} [env] */
function assertDatabaseUrlIsSafe(databaseUrl, env = process.env) {
  // 원격 마이그레이션은 배포 환경에서 명시적으로 허용한다.
  if (env[ALLOW_REMOTE_ENV] === "1") return;
  const host = resolveHost(databaseUrl);
  if (host === null) throw new Error("[db-guard] DATABASE_URL을 해석할 수 없어 실행을 중단합니다.");
  if (LOCAL_HOSTS.has(host)) return;
  throw new Error(
    `[db-guard] 원격 데이터베이스(${host}) 명령을 차단했습니다. 로컬 DATABASE_URL을 지정하거나, 의도한 원격 배포에서만 ${ALLOW_REMOTE_ENV}=1을 설정하세요.`,
  );
}

module.exports = { assertDatabaseUrlIsSafe, resolveHost, LOCAL_HOSTS, ALLOW_REMOTE_ENV };
