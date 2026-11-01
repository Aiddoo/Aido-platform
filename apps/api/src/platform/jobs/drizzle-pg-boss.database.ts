import { sql } from "drizzle-orm";
import type { Db } from "pg-boss";

import type { Database } from "#api/platform/database/database.client";

type JobSqlParameter = string | number | boolean | null | readonly string[];

function isJobSqlParameter(value: unknown): value is JobSqlParameter {
  // nullish-strict: undefined는 빠뜨린 바인딩이라 거부하고 null만 SQL NULL로 넘긴다
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    return true;
  }
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** pg-boss SQL을 현재 CLS 트랜잭션에서 실행해 작업 등록이 도메인 변경과 함께 커밋되게 한다. */
export function transactionJobDatabase(tx: Pick<Database, "execute">): Db {
  return {
    async executeSql(text, values = []) {
      const chunks = text.split(/\$(\d+)/).map((part, index) => {
        if (index % 2 === 0) {
          return sql.raw(part);
        }
        const value: unknown = values[Number(part) - 1];
        if (!isJobSqlParameter(value)) {
          throw new TypeError("Unsupported pg-boss SQL parameter");
        }
        return sql.param(value);
      });
      const { rows } = await tx.execute<Record<string, unknown>>(sql.join(chunks));
      return { rows };
    },
  };
}
