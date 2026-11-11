import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** social의 FollowReaderPort를 같은 인스턴스로 받으므로 인자는 그 포트와 같은 모양이다 */
export abstract class FriendshipReaderPort {
  abstract isMutualFriend(userId: UserId, targetUserId: UserId): Promise<boolean>;
}
