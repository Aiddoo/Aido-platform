import { eq, exists, type SQL } from "drizzle-orm";
import { QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";

import { pushToken } from "#api/platform/database/schema/index";

// 다른 Context가 사람을 한 SQL로 고를 때 푸시 토큰이 있는 사람만 남기는 조건이다. 토큰 테이블을 직접 읽지 않게 notification이 연다
export function hasPushTokenCondition(userIdColumn: AnyPgColumn): SQL {
  return exists(
    new QueryBuilder()
      .select({ id: pushToken.id })
      .from(pushToken)
      .where(eq(pushToken.userId, userIdColumn)),
  );
}
