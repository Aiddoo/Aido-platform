import { FriendshipReaderPort } from "#api/modules/insights/daily-completions/application/ports/friendship.reader.port";

export class StubFriendshipReader extends FriendshipReaderPort {
  readonly #mutualPairs = new Set<string>();

  addMutualFriends(userId: string, otherUserId: string): void {
    this.#mutualPairs.add(`${userId}:${otherUserId}`);
    this.#mutualPairs.add(`${otherUserId}:${userId}`);
  }

  async isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
    return this.#mutualPairs.has(`${userId}:${targetUserId}`);
  }
}
