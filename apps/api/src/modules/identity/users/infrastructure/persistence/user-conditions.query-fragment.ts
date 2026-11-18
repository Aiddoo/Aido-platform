import { and, eq, exists, ilike, isNull, sql, type SQL } from "drizzle-orm";
import { QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";

import { user } from "#api/platform/database/schema/index";

// 다른 Context가 사람 id 칸을 가진 행을 페이지로 고를 때 사용자 테이블을 직접 읽지 않고 한 SQL에 붙이는 조건이다

export function undeletedUserCondition(userIdColumn: AnyPgColumn): SQL {
  return exists(
    new QueryBuilder()
      .select({ one: sql`1` })
      .from(user)
      .where(and(eq(user.id, userIdColumn), isNull(user.deletedAt))),
  );
}

// LIKE 와일드카드는 글자 그대로 찾고 대소문자는 가리지 않는다
export function userTagContainsCondition(userIdColumn: AnyPgColumn, fragment: string): SQL {
  const pattern = `%${fragment.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  return exists(
    new QueryBuilder()
      .select({ one: sql`1` })
      .from(user)
      .where(and(eq(user.id, userIdColumn), ilike(user.userTag, pattern))),
  );
}

// 거꾸로 다른 Context가 자기 테이블로 만들어 넘기는 조건이다. 사용자 검색 SQL이 사용자 id 칸에 붙여 결과에서 뺀다
export type UserExclusionCondition = (userIdColumn: AnyPgColumn) => SQL;
