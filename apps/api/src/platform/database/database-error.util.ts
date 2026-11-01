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

function findDatabaseError(error: unknown): DatabaseError | undefined {
  const visited = new Set<unknown>();
  let current = error;
  while (current instanceof Error && !visited.has(current)) {
    if (current instanceof DatabaseError) {
      return current;
    }
    visited.add(current);
    current = current.cause;
  }
  return undefined;
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
