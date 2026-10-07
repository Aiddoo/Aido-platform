import { param, type RawRowSpec } from "@prisma/orm-postgres/relational-core/expression";
import type { Sql } from "sql-template-tag";

import { applicationDate, applicationTimestamp, databaseTimestamp } from "./database-values.js";
import type { Prisma8Transaction } from "./prisma8-transactional.adapter.js";

/** Parameterized SQL fragments compile to a native Prisma 8 plan and use the active CLS connection. */
export function sqlStatement(context: Pick<Prisma8Transaction, "raw">, statement: Sql) {
  const strings = Object.assign([...statement.strings], { raw: [...statement.strings] });
  const values = statement.values.map((value) => {
    if (value instanceof Date)
      return param(databaseTimestamp(value), { codecId: "pg/timestamp-string@1" });
    if (value === null) return param(null, { codecId: "pg/text@1" });
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint"
    ) {
      return value;
    }
    throw new TypeError("SQL parameters require a scalar or an explicitly encoded value");
  });
  return context.raw.sql(strings, ...values);
}

/** Preserve the literal codec and nullability types without a type assertion. */
export function sqlRowSpec<const Spec extends RawRowSpec>(spec: Spec): Spec {
  return spec;
}

type CodecId<Spec> = Spec extends string
  ? Spec
  : Spec extends { readonly codecId: infer Id }
    ? Id
    : never;
type DecodedSqlValue<Spec, Value> = Value extends null | undefined
  ? Value
  : CodecId<Spec> extends "pg/date-string@1" | "pg/timestamp-string@1"
    ? Date
    : Value;
type DecodedSqlRows<Spec, Rows> = Rows extends readonly (infer Row)[]
  ? { [K in keyof Row]: K extends keyof Spec ? DecodedSqlValue<Spec[K], Row[K]> : Row[K] }[]
  : never;

/** Convert only declared SQL date columns. JSON values and date-looking text remain untouched. */
export function decodeSqlRows<Spec extends RawRowSpec, Rows>(
  spec: Spec,
  rows: Rows,
): DecodedSqlRows<Spec, Rows>;
export function decodeSqlRows(spec: RawRowSpec, rows: unknown): unknown {
  if (!Array.isArray(rows)) throw new TypeError("SQL query must return rows");
  return rows.map((row) => {
    if (typeof row !== "object" || row === null) throw new TypeError("Invalid SQL row");
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        const column = spec[key];
        const codec = typeof column === "string" ? column : column?.codecId;
        if (
          value !== null &&
          value !== undefined &&
          (codec === "pg/date-string@1" || codec === "pg/timestamp-string@1")
        ) {
          if (typeof value !== "string") throw new TypeError(`Invalid SQL date: ${key}`);
          return [
            key,
            codec === "pg/date-string@1" ? applicationDate(value) : applicationTimestamp(value),
          ];
        }
        return [key, value];
      }),
    );
  });
}
