import { QueryBuilder } from "drizzle-orm/pg-core";

import { user } from "#api/platform/database/schema/index";

// 다른 Context가 사람 id 칸으로 마지막 활동 시각을 한 SQL에 붙이는 하위 질의다. 탈퇴 대기 사용자도 담는다
export function userLastActivity() {
  return new QueryBuilder()
    .select({ userId: user.id, lastActiveAt: user.lastActiveAt })
    .from(user)
    .as("user_activity");
}
