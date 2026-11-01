import { sql } from "drizzle-orm";
import type { Db } from "pg-boss";

import type { Database } from "#api/platform/database/database.client";

/** pg-boss SQL을 현재 CLS 트랜잭션에서 실행해 작업 등록이 도메인 변경과 함께 커밋되게 한다. */
export function transactionJobDatabase(tx: Pick<Database, "execute">): Db {
  return {
    async executeSql(text, values = []) {
      const query = sql.join(
        text
          .split(/\$(\d+)/)
          .map((part, index) =>
            index % 2 === 0 ? sql.raw(part) : sql.param(values[Number(part) - 1]),
          ),
      );
      const { rows } = await tx.execute<Record<string, unknown>>(query);
      return { rows };
    },
  };
}
