import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export abstract class FriendshipReaderPort {
  abstract isMutualFriend(userId: UserId, friendUserId: UserId): Promise<boolean>;
}
