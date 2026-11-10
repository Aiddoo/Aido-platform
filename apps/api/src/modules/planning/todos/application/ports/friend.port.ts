import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/**
 * 친구/맞팔 조회 포트 (follow 컨텍스트 경계)
 */
export abstract class FriendPort {
  abstract isMutualFriend(userId: UserId, targetUserId: UserId): Promise<boolean>;
  abstract getMutualFriendIds(userId: UserId): Promise<string[]>;
  abstract getUserDisplayName(userId: UserId): Promise<string>;
}
