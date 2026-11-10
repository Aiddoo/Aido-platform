export abstract class FollowReaderPort {
  abstract isMutualFriend(userId: string, targetUserId: string): Promise<boolean>;
  abstract countFriends(userId: string): Promise<number>;
  abstract getUserDisplayName(userId: string): Promise<string>;
  abstract getMutualFriendIds(userId: string): Promise<string[]>;
  abstract getCurrentMutualFriendIds(userId: string): Promise<string[]>;
  /** 권한을 판단하는 쓰기 경로용. 캐시 없이 두 사람 쌍만 확인한다. */
  abstract isCurrentMutualFriend(userId: string, targetUserId: string): Promise<boolean>;
}
