import { TransactionHost } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { Pool, type PoolConfig } from "pg";

import {
  createDatabase,
  type Database,
  DRIZZLE,
  type DrizzleTransactionalAdapter,
} from "#api/platform/database/database.client";
import { createPostgresPoolConfig } from "#api/platform/database/postgres-pool";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

export type TestDatabaseClient = Database & { close(): Promise<void> };

/**
 * 테스트가 자기 pool을 소유한다. 앱 pool과 같은 세션 설정(TimeZone=UTC)을 써서
 * process·서버 시간대가 다른 CI에서도 같은 SQL 결과를 본다.
 * `onStatement`는 Drizzle logger로 실행된 SQL을 관찰한다(쿼리 수 검증).
 */
export function createTestClient(
  connectionString: string,
  options: Omit<PoolConfig, "connectionString"> = {},
  onStatement?: (sql: string, params: unknown[]) => void,
): TestDatabaseClient {
  const pool = new Pool({ ...createPostgresPoolConfig(connectionString), ...options });
  const logger = onStatement && {
    logQuery: (query: string, params: unknown[]) => onStatement(query, params),
  };
  let closed = false;
  return Object.assign(createDatabase(pool, logger), {
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      await pool.end();
    },
  });
}

let transactionHostCount = 0;

/**
 * Nest 없이 운영과 같은 Drizzle 어댑터로 실제 TransactionHost를 만든다.
 * 연결 이름을 따로 줘 앱이나 다른 fixture의 CLS 트랜잭션과 섞이지 않는다.
 */
export function createTransactionHost(
  database: Database,
): TransactionHost<DrizzleTransactionalAdapter> {
  transactionHostCount += 1;
  const adapter = new TransactionalAdapterDrizzleOrm<Database>({ drizzleInstanceToken: DRIZZLE });
  return new TransactionHost<DrizzleTransactionalAdapter>({
    ...adapter.optionsFactory(database),
    connectionName: `test-fixture-${transactionHostCount}`,
    enableTransactionProxy: false,
    defaultTxOptions: {},
    extraProviderTokens: [],
  });
}

/** 저장소 integration fixture가 실제 트랜잭션과 Required 전파를 공유한다. */
export function createDatabaseTransactionFixture(client: Database) {
  const txHost = createTransactionHost(client);
  const uow: UnitOfWorkPort = { run: (work) => txHost.withTransaction(work) };
  return { txHost, uow };
}
