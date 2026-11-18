import { and, eq, notExists, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { userBlock } from "#api/platform/database/schema/index";

// 상대가 정해진 행·사람을 고를 때 차단 관계를 행마다 읽지 않고 한 SQL의 NOT EXISTS로 거른다. 두 방향 모두 UserBlock 인덱스를 탄다
export function hasNoBlockWith(userIdColumn: AnyColumn, viewerId: string): SQL {
  return notExists(
    new QueryBuilder()
      .select({ one: sql`1` })
      .from(userBlock)
      .where(
        or(
          and(eq(userBlock.blockerId, userIdColumn), eq(userBlock.blockedId, viewerId)),
          and(eq(userBlock.blockerId, viewerId), eq(userBlock.blockedId, userIdColumn)),
        ),
      ),
  );
}
