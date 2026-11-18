import { and, eq, inArray, or } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { friendship } from "#api/platform/database/schema/index";

// 다른 Context가 사람들의 맞팔(ACCEPTED) 관계를 한 SQL로 고르는 하위 질의다. 준 사람이 어느 쪽이든 그 관계 행이다
export function acceptedFriendshipsOf(personIds: readonly string[]) {
  return new QueryBuilder()
    .select({ followerId: friendship.followerId, followingId: friendship.followingId })
    .from(friendship)
    .where(
      and(
        eq(friendship.status, "ACCEPTED"),
        or(
          inArray(friendship.followerId, [...personIds]),
          inArray(friendship.followingId, [...personIds]),
        ),
      ),
    )
    .as("accepted_friendships");
}
