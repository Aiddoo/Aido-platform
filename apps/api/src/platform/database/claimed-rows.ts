import { type SQL, type SQLWrapper, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * `LIMIT … FOR UPDATE SKIP LOCKED`로 고른 행을 한 번만 평가해 UPDATE·DELETE의 대상으로 건다.
 * `IN (subquery)`는 통계가 표를 1행으로 보면 Nested Loop Semi Join이 subquery를 바깥 행마다
 * 다시 돌려 한도를 넘겨 잠그고 바꾼다. 배열로 만들면 InitPlan 하나로 고정된다.
 */
export function inClaimedRows(column: AnyPgColumn, claimed: SQLWrapper): SQL {
  return sql`${column} = ANY(ARRAY(${claimed}))`;
}
