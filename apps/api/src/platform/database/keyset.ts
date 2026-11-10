import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

type TupleOperator = "<" | ">";

function compareTuple(
  columns: readonly AnyPgColumn[],
  values: readonly unknown[],
  operator: TupleOperator,
): SQL {
  if (columns.length === 0 || columns.length !== values.length) {
    throw new Error("Keyset columns and values must be non-empty and the same length");
  }
  // 값마다 그 컬럼의 encoder를 거쳐야 Temporal 같은 custom 값이 드라이버 표현으로 바뀐다
  const params = columns.map((column, index) => sql.param(values[index], column));
  return sql`(${sql.join([...columns], sql`, `)}) ${sql.raw(operator)} (${sql.join(params, sql`, `)})`;
}

export function tupleLessThan(columns: readonly AnyPgColumn[], values: readonly unknown[]): SQL {
  return compareTuple(columns, values, "<");
}

export function tupleGreaterThan(columns: readonly AnyPgColumn[], values: readonly unknown[]): SQL {
  return compareTuple(columns, values, ">");
}
