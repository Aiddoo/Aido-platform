import { DrizzleQueryError } from "drizzle-orm/errors";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { DatabaseError } from "pg";

import * as tables from "./schema/tables.schema.js";

function uniqueColumnEntries(table: PgTable): [string, string[]][] {
  const config = getTableConfig(table);
  const indexes = config.indexes.flatMap((index): [string, string[]][] =>
    index.config.unique && index.config.name != null
      ? [
          [
            index.config.name,
            index.config.columns.flatMap((column) =>
              "name" in column && column.name != null ? [column.name] : [],
            ),
          ],
        ]
      : [],
  );
  const constraints = config.uniqueConstraints.flatMap((constraint): [string, string[]][] => {
    const name = constraint.getName();
    return name == null ? [] : [[name, constraint.columns.map((column) => column.name)]];
  });
  return [...indexes, ...constraints];
}

const uniqueColumnsByConstraint = new Map(
  Object.values(tables).flatMap((table) =>
    table instanceof PgTable ? uniqueColumnEntries(table) : [],
  ),
);

function causeChain(error: unknown): Error[] {
  const chain: Error[] = [];
  let current = error;
  while (current instanceof Error && !chain.includes(current)) {
    chain.push(current);
    current = current.cause;
  }
  return chain;
}

function findDatabaseError(error: unknown): DatabaseError | undefined {
  return causeChain(error).find((cause) => cause instanceof DatabaseError);
}

export function databaseSqlState(error: unknown): string | undefined {
  return findDatabaseError(error)?.code;
}

export function databaseConstraint(error: unknown): string | undefined {
  return findDatabaseError(error)?.constraint;
}

/** 단건 변경이 대상 행을 찾지 못했음을 repository 계약의 부재 오류로 드러낸다. */
export class DatabaseRecordNotFoundError extends Error {
  constructor() {
    super("Database record not found");
    this.name = "DatabaseRecordNotFoundError";
  }
}

export function requireRecord<Row>(row: Row | null | undefined): Row {
  if (row == null) {
    throw new DatabaseRecordNotFoundError();
  }
  return row;
}

export function isUniqueConstraintViolation(error: unknown): boolean {
  return databaseSqlState(error) === "23505";
}

export function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof DatabaseRecordNotFoundError;
}

/** Serializable 충돌·교착은 같은 작업을 다시 시도할 수 있다. */
export function isTransactionWriteConflict(error: unknown): boolean {
  const sqlState = databaseSqlState(error);
  return sqlState === "40001" || sqlState === "40P01";
}

/** 유니크 위반의 constraint 이름을 스키마의 컬럼 목록으로 바꾼다. */
export function uniqueConstraintTargets(error: unknown): string[] | undefined {
  const databaseError = findDatabaseError(error);
  if (databaseError?.code !== "23505" || databaseError.constraint == null) {
    return undefined;
  }
  const columns = uniqueColumnsByConstraint.get(databaseError.constraint);
  return columns == null ? undefined : [...columns];
}

export type DatabaseErrorKind =
  | "unique-violation"
  | "foreign-key-violation"
  | "check-violation"
  | "serialization-failure"
  | "deadlock"
  | "lock-timeout"
  | "statement-timeout"
  | "connection"
  | "pool-timeout"
  | "query-timeout"
  | "unknown";

const DATABASE_ERROR_KIND_BY_SQL_STATE: Readonly<Record<string, DatabaseErrorKind>> = {
  "23505": "unique-violation",
  "23503": "foreign-key-violation",
  "23514": "check-violation",
  "40001": "serialization-failure",
  "40P01": "deadlock",
  "55P03": "lock-timeout",
  "57014": "statement-timeout",
  "57P01": "connection",
};

// SQLSTATE 08 계열은 연결 예외 묶음이라 코드 하나하나가 아니라 class로 분류한다
const CONNECTION_EXCEPTION_CLASS = "08";

// SQLSTATE가 없는 연결 문제는 pg·pg-pool이 고정 문구로 던진다
const POOL_TIMEOUT_MESSAGE = "timeout exceeded when trying to connect";
// 클라이언트 query_timeout이 지나도록 DB가 답하지 않았다
const QUERY_TIMEOUT_MESSAGE = "Query read timeout";
const CONNECTION_LOST_MESSAGE = /^Connection terminated/;
// 네트워크 오류 code는 외부 HTTP 호출에서도 나오므로 Drizzle 쿼리 오류 아래에 있을 때만 DB 연결 문제로 본다
const NETWORK_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "EHOSTUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

function classifyWithoutSqlState(error: unknown): DatabaseErrorKind {
  const chain = causeChain(error);
  if (chain.some((cause) => cause.message === POOL_TIMEOUT_MESSAGE)) {
    return "pool-timeout";
  }
  if (chain.some((cause) => cause.message === QUERY_TIMEOUT_MESSAGE)) {
    return "query-timeout";
  }
  if (chain.some((cause) => CONNECTION_LOST_MESSAGE.test(cause.message))) {
    return "connection";
  }
  const isQueryFailure = chain.some((cause) => cause instanceof DrizzleQueryError);
  const hasNetworkCode = chain.some((cause) => {
    const code: unknown = Reflect.get(cause, "code");
    return typeof code === "string" && NETWORK_ERROR_CODES.has(code);
  });
  return isQueryFailure && hasNetworkCode ? "connection" : "unknown";
}

export function classifyDatabaseError(error: unknown): DatabaseErrorKind {
  const sqlState = databaseSqlState(error);
  if (sqlState == null) {
    return classifyWithoutSqlState(error);
  }
  if (sqlState.startsWith(CONNECTION_EXCEPTION_CLASS)) {
    return "connection";
  }
  return DATABASE_ERROR_KIND_BY_SQL_STATE[sqlState] ?? "unknown";
}
