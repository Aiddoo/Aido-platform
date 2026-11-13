import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export abstract class FriendshipCachePort {
  // 미스는 undefined다. 키는 호출부가 정규화한 (smaller, larger)다
  abstract getMutualFriend(smallerId: UserId, largerId: UserId): Promise<boolean | undefined>;
  abstract setMutualFriend(smallerId: UserId, largerId: UserId, isMutual: boolean): Promise<void>;
  // 두 사람 순서는 안에서 정규화한다
  abstract invalidateMutualFriend(userId: UserId, targetUserId: UserId): Promise<void>;
  abstract wrapMutualFriendIds(userId: UserId, factory: () => Promise<string[]>): Promise<string[]>;
  abstract invalidateMutualFriendIds(userId: UserId): Promise<void>;
  abstract wrapFriendCount(userId: UserId, factory: () => Promise<number>): Promise<number>;
  abstract invalidateFriendCount(userId: UserId): Promise<void>;
}

export type FriendshipCacheInvalidator = Pick<
  FriendshipCachePort,
  "invalidateMutualFriend" | "invalidateMutualFriendIds" | "invalidateFriendCount"
>;

// 두 사람 사이 친구 관계가 바뀐 뒤 맞팔 여부·친구 id 목록·친구 수 캐시를 함께 비운다
export async function invalidateFriendshipCaches(
  cache: FriendshipCacheInvalidator,
  userId: UserId,
  targetUserId: UserId,
): Promise<void> {
  await Promise.all([
    cache.invalidateMutualFriend(userId, targetUserId),
    cache.invalidateMutualFriendIds(userId),
    cache.invalidateMutualFriendIds(targetUserId),
    cache.invalidateFriendCount(userId),
    cache.invalidateFriendCount(targetUserId),
  ]);
}
