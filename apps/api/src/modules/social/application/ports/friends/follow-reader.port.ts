export const FOLLOW_READER = Symbol("FOLLOW_READER");

export interface FollowReaderPort {
  isMutualFriend(userId: string, targetUserId: string): Promise<boolean>;
  countFriends(userId: string): Promise<number>;
  getUserDisplayName(userId: string): Promise<string>;
  getMutualFriendIds(userId: string): Promise<string[]>;
  getCurrentMutualFriendIds(userId: string): Promise<string[]>;
  /** 권한을 판단하는 쓰기 경로용. 캐시 없이 두 사람 쌍만 확인한다. */
  isCurrentMutualFriend(userId: string, targetUserId: string): Promise<boolean>;
}
