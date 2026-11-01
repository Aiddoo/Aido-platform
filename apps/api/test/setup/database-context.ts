import { AsyncLocalStorage } from "node:async_hooks";

import type { TransactionHost } from "@nestjs-cls/transactional";
import { Pool, type PoolConfig } from "pg";
import { mock } from "vitest-mock-extended";

import {
  createDatabase,
  type Database,
  type DrizzleTransactionalAdapter,
} from "#api/platform/database/database.client";
import { createPostgresPoolConfig } from "#api/platform/database/postgres-pool";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

export type TestDatabaseClient = Database & { close(): Promise<void> };

/**
 * 테스트가 자기 pool을 소유한다. 앱 pool과 같은 세션 설정(TimeZone=UTC)을 써서
 * process·서버 시간대가 다른 CI에서도 같은 SQL 결과를 본다.
 */
export function createTestClient(
  connectionString: string,
  options: Omit<PoolConfig, "connectionString"> = {},
): TestDatabaseClient {
  const pool = new Pool({ ...createPostgresPoolConfig(connectionString), ...options });
  let closed = false;
  return Object.assign(createDatabase(pool), {
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      await pool.end();
    },
  });
}

/** 저장소 integration fixture가 실제 트랜잭션과 Required 전파를 공유한다. */
export function createDatabaseTransactionFixture(client: Database) {
  const active = new AsyncLocalStorage<Database>();
  const host = mock<TransactionHost<DrizzleTransactionalAdapter>>();
  Object.defineProperty(host, "tx", { get: () => active.getStore() ?? client });
  host.isTransactionActive.mockImplementation(() => active.getStore() !== undefined);
  const uow: UnitOfWorkPort = {
    async run(work) {
      if (active.getStore() !== undefined) {
        return work();
      }
      return client.transaction((tx) => active.run(tx, work));
    },
  };
  return { txHost: host, uow };
}
