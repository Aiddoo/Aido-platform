import type { TransactionHost } from "@nestjs-cls/transactional";
import type { SQL } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { PgDialect } from "drizzle-orm/pg-core";
import { DatabaseError, type Pool, type QueryResult } from "pg";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import {
  createDatabase,
  type Database,
  type DrizzleTransactionalAdapter,
} from "#api/platform/database/database.client";

const dialect = new PgDialect();

/** Drizzle SQL 객체를 PostgreSQL 문장과 파라미터로 렌더링한다. */
export function renderSql(query: SQL): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(query);
}

/** 쿼리 체인 호출만 확인하는 단위 테스트용 TransactionHost. */
export function createMockDrizzleTransactionHost(database = mock<Database>()) {
  const host = mock<TransactionHost<DrizzleTransactionalAdapter>>();
  Object.defineProperty(host, "tx", { get: () => database });
  return { host, database };
}

export interface ExecutedStatement {
  readonly text: string;
  readonly params: readonly unknown[];
}

export function queryResult(rows: object[] = []): QueryResult {
  return { rows, rowCount: rows.length, command: "", oid: 0, fields: [] };
}

/**
 * 실제 Drizzle 클라이언트를 가짜 pg Pool에 연결한다.
 * SQL 렌더링은 실제 Drizzle이 하고, 응답만 `respond`로 제어한다.
 */
export function createFakeDatabase(
  respond: (statement: ExecutedStatement) => Promise<QueryResult> = async () => queryResult(),
) {
  const statements: ExecutedStatement[] = [];
  const pool = mock<Pool>();
  const query = vi.fn(async (config: { text: string }, params: readonly unknown[] = []) => {
    const statement = { text: config.text, params };
    statements.push(statement);
    return respond(statement);
  });
  Object.assign(pool, { query });
  return { database: createDatabase(pool), statements };
}

export function createFakeTransactionHost(
  respond?: (statement: ExecutedStatement) => Promise<QueryResult>,
) {
  const { database, statements } = createFakeDatabase(respond);
  const host = mock<TransactionHost<DrizzleTransactionalAdapter>>();
  Object.defineProperty(host, "tx", { get: () => database });
  return { host, database, statements };
}

export function postgresError(sqlState: string, constraint?: string): DatabaseError {
  return Object.assign(new DatabaseError(`PostgreSQL ${sqlState}`, 0, "error"), {
    code: sqlState,
    constraint,
  });
}

export function sqlQueryError(sqlState: string, constraint?: string): Error {
  return new DrizzleQueryError("SELECT 1", [], postgresError(sqlState, constraint));
}
