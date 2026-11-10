import { Pool, type PoolConfig } from "pg";

import type { TypedConfigService } from "#api/platform/config/services/config.service";

// 세션 TimeZone을 UTC로 고정해 now() 기본값과 timestamp 비교가 서버·프로세스 TZ에 흔들리지 않게 한다
export function createPostgresPoolConfig(databaseUrl: string): PoolConfig {
  const url = new URL(databaseUrl);
  const hasSslMode = url.searchParams.has("sslmode");
  url.searchParams.delete("sslmode");
  return {
    connectionString: url.toString(),
    options: "-c TimeZone=UTC",
    ...(hasSslMode && { ssl: { rejectUnauthorized: false } }),
  };
}

export function createPostgresPool(database: TypedConfigService["database"]): Pool {
  const { url, poolMax, idleTimeoutMs, connectionTimeoutMs } = database;
  return new Pool({
    ...createPostgresPoolConfig(url),
    max: poolMax,
    ...(idleTimeoutMs != null && { idleTimeoutMillis: idleTimeoutMs }),
    ...(connectionTimeoutMs != null && { connectionTimeoutMillis: connectionTimeoutMs }),
  });
}
