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
