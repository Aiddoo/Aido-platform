import { Column, is, SQL, type SQLWrapper, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

type TupleOperator = "<" | ">";

/** 비교할 칸. 컬럼이 아닌 식(예: `isNotNull(parentId)`)도 튜플 원소로 쓸 수 있다 */
export type KeysetOperand = AnyPgColumn | SQL;

function isExpression(value: unknown): value is SQLWrapper {
  return is(value, Column) || is(value, SQL) || is(value, SQL.Aliased);
}

function compareTuple(
  columns: readonly KeysetOperand[],
  values: readonly unknown[],
  operator: TupleOperator,
): SQL {
  if (columns.length === 0 || columns.length !== values.length) {
    throw new Error("Keyset columns and values must be non-empty and the same length");
  }
  // 값마다 그 컬럼의 encoder를 거쳐야 Temporal 같은 custom 값이 드라이버 표현으로 바뀐다.
  // 기준 행의 컬럼(CTE 칸 등)은 매개변수가 아니라 식 그대로 비교한다
  const operands = columns.map((column, index) => {
    const value = values[index];
    if (isExpression(value)) {
      return value;
    }
    return is(column, Column) ? sql.param(value, column) : sql.param(value);
  });
  return sql`(${sql.join([...columns], sql`, `)}) ${sql.raw(operator)} (${sql.join(operands, sql`, `)})`;
}

export function tupleLessThan(columns: readonly KeysetOperand[], values: readonly unknown[]): SQL {
  return compareTuple(columns, values, "<");
}

export function tupleGreaterThan(
  columns: readonly KeysetOperand[],
  values: readonly unknown[],
): SQL {
  return compareTuple(columns, values, ">");
}
