import { getColumnTable, getTableName, is, sql } from "drizzle-orm";
import { type AnyPgColumn, getTableConfig, PgTable } from "drizzle-orm/pg-core";

import type { Database } from "./database.client.js";

type SequenceExecutor = Pick<Database, "execute">;

// pg_get_serial_sequence는 대소문자가 섞인 테이블 이름("Memo")을 따옴표로 감싸야 찾는다
function qualifiedTableName(column: AnyPgColumn): string {
  const table = getColumnTable(column);
  if (!is(table, PgTable)) {
    throw new Error("Sequence column must belong to a PostgreSQL table");
  }
  const schema = getTableConfig(table).schema;
  const tableName = `"${getTableName(table)}"`;
  return schema == null ? tableName : `"${schema}".${tableName}`;
}

export async function nextSequenceValues(
  db: SequenceExecutor,
  column: AnyPgColumn,
  count: number,
): Promise<number[]> {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("Sequence value count must be a positive integer");
  }
  const result = await db.execute<{ value: string }>(
    sql`select nextval(pg_get_serial_sequence(${qualifiedTableName(column)}, ${column.name})) as value from generate_series(1, ${count})`,
  );
  // bigint는 pg가 문자열로 돌려준다. serial id는 Number 범위 안이다
  return result.rows.map((row) => Number(row.value)).toSorted((left, right) => left - right);
}

export async function nextSequenceValue(
  db: SequenceExecutor,
  column: AnyPgColumn,
): Promise<number> {
  const [value] = await nextSequenceValues(db, column, 1);
  if (value == null) {
    throw new Error("Sequence returned no value");
  }
  return value;
}
