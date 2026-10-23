import type { SqlMiddleware } from "@prisma/orm-postgres/family-runtime";

export interface ObservedStatement {
  readonly sql: string;
  readonly path: "query" | "execute";
}

const statementSql = Symbol("statement-observer.sql");

/** Reports each statement the driver ran; rc.18 activity hooks expose lowered SQL only in beforeEncode. */
export function createStatementObserver(
  name: string,
  onStatement: (statement: ObservedStatement) => void,
): SqlMiddleware {
  return {
    name,
    familyId: "sql",
    async beforeEncode(plan, context) {
      context.state(statementSql)["sql"] = plan.sql;
    },
    async activityEnded(_activity, result, context) {
      if (result.kind !== "statement" || result.source !== "driver") {
        return;
      }
      const sql = context.state(statementSql)["sql"];
      if (typeof sql === "string") {
        onStatement({ sql, path: result.returns === "rows" ? "query" : "execute" });
      }
    },
  };
}
