import { and, eq, isNull } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { user } from "#api/platform/database/schema/index";

type AccessColumnName = "id" | "role" | "subscriptionStatus" | "subscriptionExpiresAt";

// 권한 판단(역할·구독 projection)에 쓰는 사용자 칸이다. identity 하위 질의(userAccessSubjects·userRecipients·userAudience)의 칸이 모두 맞는다
export type UserAccessColumns =
  | Pick<typeof user, AccessColumnName>
  | Pick<ReturnType<typeof userAccessSubjects>, AccessColumnName>;

// 다른 Context가 권한을 판단할 사용자 행을 한 SQL로 읽는 하위 질의다.
// activeOnly면 ACTIVE이고 탈퇴 대기가 아닌 사용자만 담는다. 활성 규칙은 identity가 정한다
export function userAccessSubjects(filter: { readonly activeOnly: boolean }) {
  return new QueryBuilder()
    .select({
      id: user.id,
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
    })
    .from(user)
    .where(filter.activeOnly ? and(eq(user.status, "ACTIVE"), isNull(user.deletedAt)) : undefined)
    .as("access_subject");
}
