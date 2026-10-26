import { type FollowCachePort } from "../../ports/friends/follow-cache.port.js";

export type FriendshipCacheInvalidator = Pick<
  FollowCachePort,
  "invalidateMutualFriend" | "invalidateMutualFriendIds" | "invalidateFriendCount"
>;

/** 두 사용자 사이의 친구 관계가 바뀐 뒤 맞팔 여부·친구 ID 목록·친구 수 캐시를 함께 비운다. */
export async function invalidateFriendshipCaches(
  cache: FriendshipCacheInvalidator,
  userId: string,
  targetUserId: string,
): Promise<void> {
  await Promise.all([
    cache.invalidateMutualFriend(userId, targetUserId),
    cache.invalidateMutualFriendIds(userId),
    cache.invalidateMutualFriendIds(targetUserId),
    cache.invalidateFriendCount(userId),
    cache.invalidateFriendCount(targetUserId),
  ]);
}
