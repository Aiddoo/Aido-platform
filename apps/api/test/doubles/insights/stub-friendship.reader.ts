import { FriendshipReaderPort } from "#api/modules/insights/daily-completions/application/ports/friendship.reader.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export class StubFriendshipReader extends FriendshipReaderPort {
  readonly #mutualPairs = new Set<string>();

  addMutualFriends(userId: string, otherUserId: string): void {
    this.#mutualPairs.add(`${userId}:${otherUserId}`);
    this.#mutualPairs.add(`${otherUserId}:${userId}`);
  }

  async isMutualFriend(userId: UserId, targetUserId: UserId): Promise<boolean> {
    return this.#mutualPairs.has(`${userId.value}:${targetUserId.value}`);
  }
}
