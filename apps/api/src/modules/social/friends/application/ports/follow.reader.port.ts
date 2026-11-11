import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export abstract class FollowReaderPort {
  abstract isMutualFriend(userId: UserId, targetUserId: UserId): Promise<boolean>;
  abstract countFriends(userId: UserId): Promise<number>;
  abstract getUserDisplayName(userId: UserId): Promise<string>;
  abstract getMutualFriendIds(userId: UserId): Promise<string[]>;
  abstract getCurrentMutualFriendIds(userId: UserId): Promise<string[]>;
  /** 권한을 판단하는 쓰기 경로용. 캐시 없이 두 사람 쌍만 확인한다. */
  abstract isCurrentMutualFriend(userId: UserId, targetUserId: UserId): Promise<boolean>;
}
