import { eq, exists, or, sql, type SQL } from "drizzle-orm";
import { QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";

import { pushDevice, pushToken } from "#api/platform/database/schema/index";

// 다른 Context가 사람을 한 SQL로 고를 때 푸시 토큰이 있는 사람만 남기는 조건이다. 토큰 테이블을 직접 읽지 않게 notification이 연다
export function hasPushTokenCondition(userIdColumn: AnyPgColumn): SQL {
  return exists(
    new QueryBuilder()
      .select({ id: pushToken.id })
      .from(pushToken)
      .where(eq(pushToken.userId, userIdColumn)),
  );
}

// 세션 행을 지우면 FK CASCADE로 그 세션의 기기·토큰이 함께 지워져 identity가 지우기 전에 묻는다
export function hasPushRegistrationForSessionCondition(sessionIdColumn: AnyPgColumn): SQL {
  const devices = new QueryBuilder()
    .select({ one: sql`1` })
    .from(pushDevice)
    .where(eq(pushDevice.sessionId, sessionIdColumn));
  const tokens = new QueryBuilder()
    .select({ one: sql`1` })
    .from(pushToken)
    .where(eq(pushToken.sessionId, sessionIdColumn));
  return sql`(${or(exists(devices), exists(tokens))})`;
}
