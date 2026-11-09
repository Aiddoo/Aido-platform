import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { Pool, type PoolConfig } from "pg";

import { TypedConfigService } from "#api/platform/config/services/config.service";

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

/** PostgreSQL 연결 풀. ORM의 module destroy 뒤 한 번만 종료한다. */
@Injectable()
export class PostgresPool implements OnApplicationShutdown {
  readonly pool: Pool;

  constructor(config: TypedConfigService) {
    const { url, poolMax, idleTimeoutMs, connectionTimeoutMs } = config.database;
    this.pool = new Pool({
      ...createPostgresPoolConfig(url),
      max: poolMax,
      ...(idleTimeoutMs != null && { idleTimeoutMillis: idleTimeoutMs }),
      ...(connectionTimeoutMs != null && { connectionTimeoutMillis: connectionTimeoutMs }),
    });
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
