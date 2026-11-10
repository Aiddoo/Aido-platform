export const FOLLOW_CACHE = Symbol("FOLLOW_CACHE");

export interface FollowCachePort {
  /** 맞팔 여부 조회 (미스 시 undefined) — 키는 호출부가 정규화한 (smaller, larger) */
  getMutualFriend(smallerId: string, largerId: string): Promise<boolean | undefined>;
  /** 맞팔 여부 캐싱 */
  setMutualFriend(smallerId: string, largerId: string, isMutual: boolean): Promise<void>;
  /** 두 사용자 간 맞팔 여부 캐시 무효화 (내부 정규화) */
  invalidateMutualFriend(userId: string, targetUserId: string): Promise<void>;

  /** 맞팔 친구 ID 목록 read-through */
  wrapMutualFriendIds(userId: string, factory: () => Promise<string[]>): Promise<string[]>;
  invalidateMutualFriendIds(userId: string): Promise<void>;

  /** 친구 수 read-through */
  wrapFriendCount(userId: string, factory: () => Promise<number>): Promise<number>;
  invalidateFriendCount(userId: string): Promise<void>;
}

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
