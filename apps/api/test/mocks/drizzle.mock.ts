import type { TransactionHost } from "@nestjs-cls/transactional";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { mock } from "vitest-mock-extended";

import type { Database, DrizzleTransactionalAdapter } from "#api/platform/database/database.client";

const dialect = new PgDialect();

/** 실행된 Drizzle SQL을 PostgreSQL 문장과 파라미터로 렌더링한다. */
export function renderSql(query: SQL): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(query);
}

export function createMockDrizzleTransactionHost(database = mock<Database>()) {
  const host = mock<TransactionHost<DrizzleTransactionalAdapter>>();
  Object.defineProperty(host, "tx", { get: () => database });
  return { host, database };
}
