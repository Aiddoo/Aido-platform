import type { SqlMiddleware } from "@prisma/orm-postgres/family-runtime";

import { databaseTimestamp } from "./database-values.js";

const normalizeTimestampParameters: NonNullable<SqlMiddleware["beforeQuery"]> = (
  _plan,
  _context,
  parameters,
) => {
  for (const entry of parameters?.entries() ?? []) {
    // SDK의 자동 timestamp Date도 pg의 로컬 시각 직렬화 전에 UTC 계약으로 변환한다.
    if (entry.codecId === "pg/timestamp-string@1" && entry.value instanceof Date) {
      parameters?.replaceValue(entry.ref, databaseTimestamp(entry.value));
    }
  }
};

export const utcTimestampParameters: SqlMiddleware = {
  name: "utc-timestamp-parameters",
  familyId: "sql",
  beforeQuery: normalizeTimestampParameters,
  beforeExecute: normalizeTimestampParameters,
};
