import { eq, isNull, type SQL } from "drizzle-orm";
import { QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";

import { user, userProfile } from "#api/platform/database/schema/index";

export interface UserRecipients {
  readonly table: typeof user;
  readonly userId: typeof user.id;
  readonly lastActiveAt: typeof user.lastActiveAt;
  readonly createdAt: typeof user.createdAt;
  readonly undeleted: SQL;
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
  };
}

// 사람 id 칸 옆에 프로필 이름을 붙이는 lateral 하위 질의다. 사람마다 한 행을 인덱스로 찾고, 프로필 행이 없으면 칸이 모두 null이다
export function userProfileNameOf(userIdColumn: AnyPgColumn) {
  return new QueryBuilder()
    .select({ userId: userProfile.userId, name: userProfile.name })
    .from(userProfile)
    .where(eq(userProfile.userId, userIdColumn))
    .limit(1)
    .as("profile_name");
}
