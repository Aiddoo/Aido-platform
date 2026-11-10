import type { ConfigType } from "@nestjs/config";
import { Pool, type PoolConfig } from "pg";

import type { databaseConfig } from "#api/platform/config/database.config";

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

export function createPostgresPool(database: ConfigType<typeof databaseConfig>): Pool {
  const { url, poolMax, idleTimeoutMs, connectionTimeoutMs } = database;
  return new Pool({
    ...createPostgresPoolConfig(url),
    max: poolMax,
    ...(idleTimeoutMs != null && { idleTimeoutMillis: idleTimeoutMs }),
    ...(connectionTimeoutMs != null && { connectionTimeoutMillis: connectionTimeoutMs }),
  });
}
