// 옛 Symbol 토큰. planning·insights가 클래스 토큰으로 옮길 때까지 FollowReaderPort의 같은 인스턴스 별칭이다
export const FOLLOW_READER = Symbol("FOLLOW_READER");

export abstract class FollowReaderPort {
  abstract isMutualFriend(userId: string, targetUserId: string): Promise<boolean>;
  abstract countFriends(userId: string): Promise<number>;
  abstract getUserDisplayName(userId: string): Promise<string>;
  abstract getMutualFriendIds(userId: string): Promise<string[]>;
  abstract getCurrentMutualFriendIds(userId: string): Promise<string[]>;
  /** 권한을 판단하는 쓰기 경로용. 캐시 없이 두 사람 쌍만 확인한다. */
  abstract isCurrentMutualFriend(userId: string, targetUserId: string): Promise<boolean>;
}
