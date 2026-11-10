import type { SQL } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { PgDialect } from "drizzle-orm/pg-core";
import { Client, DatabaseError, Pool, type QueryResult } from "pg";
import { vi } from "vitest";

import { createDatabase, type Database } from "#api/platform/database/database.client";
import { createTransactionHost } from "#test/setup/database-context";

const dialect = new PgDialect();

/** Drizzle SQL 객체를 PostgreSQL 문장과 파라미터로 렌더링한다. */
export function renderSql(query: SQL): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(query);
}

/** 트랜잭션 밖에서 `tx`가 주어진 database인 실제 TransactionHost. */
export function createMockDrizzleTransactionHost(database: Database) {
  return { host: createTransactionHost(database), database };
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
  const query = vi.fn(async (config: { text: string }, params: readonly unknown[] = []) => {
    const statement = { text: config.text, params };
    statements.push(statement);
    return respond(statement);
  });
  // 연결하지 않는 pg 객체에 query만 바꿔 끼운다. 트랜잭션은 pool.connect()가 준 client로 같은 query를 부른다
  const client = Object.assign(new Client(), { query, release: () => undefined });
  const pool = Object.assign(new Pool(), { query, connect: async () => client });
  return { database: createDatabase(pool), statements };
}

/** 트랜잭션 밖에서 `tx`가 가짜 pool을 쓰는 database인 실제 TransactionHost. */
export function createFakeTransactionHost(
  respond?: (statement: ExecutedStatement) => Promise<QueryResult>,
) {
  const { database, statements } = createFakeDatabase(respond);
  return { host: createTransactionHost(database), database, statements };
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
