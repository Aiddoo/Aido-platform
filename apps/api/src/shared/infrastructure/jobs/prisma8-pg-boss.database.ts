import { z } from "@aido/validators";
import { param } from "@prisma/orm-postgres/relational-core/expression";
import type { Db } from "pg-boss";

import type { Prisma8Transaction } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

/** pg-boss owns its SQL; enqueue/find return IDs and cancellation returns a count. */
export function nativeJobDatabase(tx: Prisma8Transaction, result: "id" | "count"): Db {
  return {
    async executeSql(text, values = []) {
      const strings: string[] = [];
      const parameters: ReturnType<typeof param>[] = [];
      let offset = 0;
      for (const match of text.matchAll(/\$(\d+)/g)) {
        strings.push(text.slice(offset, match.index));
        const value = values[Number(match[1]) - 1];
        // pg-boss cancellation passes UUID[]; bind its validated PostgreSQL array representation.
        const encoded = Array.isArray(value)
          ? `{${z.array(z.uuid()).parse(value).join(",")}}`
          : value;
        if (
          encoded !== null &&
          typeof encoded !== "string" &&
          typeof encoded !== "number" &&
          typeof encoded !== "boolean"
        ) {
          throw new TypeError("Unsupported pg-boss SQL parameter");
        }
        parameters.push(param(encoded === null ? null : String(encoded), { codecId: "pg/text@1" }));
        offset = match.index + match[0].length;
      }
      strings.push(text.slice(offset));
      const statement = tx.raw.sql(Object.assign(strings, { raw: [...strings] }), ...parameters);
      const rows =
        result === "id"
          ? await tx.query(statement.returnsRow({ id: "pg/uuid@1" }).build())
          : await tx.query(statement.returnsRow({ count: "pg/int8@1" }).build());
      return { rows };
    },
  };
}
