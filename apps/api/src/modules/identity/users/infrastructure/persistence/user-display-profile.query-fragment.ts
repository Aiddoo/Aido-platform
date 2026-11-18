import { eq } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { user, userProfile } from "#api/platform/database/schema/index";

// 다른 Context가 사람 id 칸 옆에 화면에 보일 이름·Aido ID·프로필 사진을 한 SQL로 붙이는 하위 질의다.
// 프로필 행이 없으면 이름·사진이 null이다. 한 SQL에 여러 번 붙일 때는 별칭을 다르게 준다
export function userDisplayProfiles(alias: string) {
  return new QueryBuilder()
    .select({
      userId: user.id,
      userTag: user.userTag,
      name: userProfile.name,
      profileImage: userProfile.profileImage,
    })
    .from(user)
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .as(alias);
}
