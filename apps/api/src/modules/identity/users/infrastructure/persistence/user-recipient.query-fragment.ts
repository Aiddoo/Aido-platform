import { and, eq, isNull, type SQL } from "drizzle-orm";
import { QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";

import { user, userProfile } from "#api/platform/database/schema/index";

export interface UserRecipients {
  readonly table: typeof user;
  readonly userId: typeof user.id;
  readonly lastActiveAt: typeof user.lastActiveAt;
  readonly createdAt: typeof user.createdAt;
  readonly undeleted: SQL;
  // ACTIVE이고 탈퇴 대기가 아니다
  readonly active: SQL | undefined;
}

// 다른 Context가 자기 조건(권한·설정·할 일)으로 받는 사람을 한 SQL에 고를 때 쓰는 사용자 테이블·칸이다.
// userAudience와 달리 탈퇴 대기를 빼지 않는다. 뺄지는 부르는 쪽이 undeleted로 고른다
export function userRecipients(): UserRecipients {
  return {
    table: user,
    userId: user.id,
    lastActiveAt: user.lastActiveAt,
    createdAt: user.createdAt,
    undeleted: isNull(user.deletedAt),
    active: and(eq(user.status, "ACTIVE"), isNull(user.deletedAt)),
  };
}

// 사람 id 칸 옆에 프로필 이름을 붙이는 lateral 하위 질의다. 사람마다 한 행을 인덱스로 찾고, 프로필 행이 없으면 칸이 모두 null이다.
// 한 SQL에 여러 번 붙일 때는 별칭을 다르게 준다
export function userProfileNameOf(userIdColumn: AnyPgColumn, alias = "profile_name") {
  return new QueryBuilder()
    .select({ userId: userProfile.userId, name: userProfile.name })
    .from(userProfile)
    .where(eq(userProfile.userId, userIdColumn))
    .limit(1)
    .as(alias);
}

// 사람 id 칸 옆에 그 사람의 마지막 활동 시각을 붙이는 lateral 하위 질의다. 한 SQL에 여러 번 붙일 때는 별칭을 다르게 준다
export function userLastActivityOf(userIdColumn: AnyPgColumn, alias: string) {
  return new QueryBuilder()
    .select({ userId: user.id, lastActiveAt: user.lastActiveAt })
    .from(user)
    .where(eq(user.id, userIdColumn))
    .limit(1)
    .as(alias);
}
