import { and, eq, notExists, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { userBlock } from "#api/platform/database/schema/index";

/**
 * 사용자와 viewer 사이에 어느 방향으로든 차단이 없을 때만 참이다.
 *
 * 콕·응원 기록처럼 상대 사용자가 정해진 행을 고를 때 붙여 한 SQL 안의
 * NOT EXISTS로 처리한다. 차단 관계를 행마다 따로 조회하지 않는다.
 */
export function hasNoBlockWith(userId: AnyColumn, viewerId: string): SQL {
  return notExists(
    new QueryBuilder()
      .select({ one: sql`1` })
      .from(userBlock)
      .where(
        or(
          and(eq(userBlock.blockerId, userId), eq(userBlock.blockedId, viewerId)),
          and(eq(userBlock.blockerId, viewerId), eq(userBlock.blockedId, userId)),
        ),
      ),
  );
}
