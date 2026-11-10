import type { ConfigType } from "@nestjs/config";
import { Pool, type PoolConfig } from "pg";

import type { databaseConfig } from "#api/platform/config/database.config";

export interface PostgresPoolOptions {
  readonly max?: number;
  readonly idleTimeoutMs?: number;
  readonly connectionTimeoutMs?: number;
  readonly allowUnverifiedTls?: boolean;
}

// TimeZone을 UTC로 고정해 now()·timestamp 비교가 서버 TZ에 흔들리지 않게 한다.
// 트랜잭션 모드 풀러(PgBouncer·RDS Proxy)는 시작 옵션을 넘기지 않으므로 그때 DB·역할 기본값으로 옮긴다.
const SESSION_OPTIONS = [
  "-c TimeZone=UTC",
  "-c statement_timeout=15000",
  "-c lock_timeout=5000",
  "-c idle_in_transaction_session_timeout=60000",
].join(" ");

/**
 * sslmode는 URL에서 떼어 ssl 옵션으로 옮긴다. pg는 URL 값이 ssl 옵션을 덮어쓰기 때문이다.
 * 인증서는 이미지의 NODE_EXTRA_CA_CERTS(RDS CA 묶음)로 검증한다.
 */
export function createPostgresPoolConfig(
  databaseUrl: string,
  options: PostgresPoolOptions = {},
): PoolConfig {
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");
  const usesTls = sslMode != null && sslMode !== "disable";
  return {
    connectionString: url.toString(),
    application_name: "aido-api",
    options: SESSION_OPTIONS,
    ...(usesTls && { ssl: { rejectUnauthorized: options.allowUnverifiedTls !== true } }),
    ...(options.max != null && { max: options.max }),
    ...(options.idleTimeoutMs != null && { idleTimeoutMillis: options.idleTimeoutMs }),
    ...(options.connectionTimeoutMs != null && {
      connectionTimeoutMillis: options.connectionTimeoutMs,
    }),
  };
}

export function createPostgresPool(database: ConfigType<typeof databaseConfig>): Pool {
  const { url, poolMax, ...options } = database;
  return new Pool(createPostgresPoolConfig(url, { max: poolMax, ...options }));
}
