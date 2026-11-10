import { FollowReaderPort } from "#api/modules/social/friends/social-friends.public";

function pairKey(userId: string, targetUserId: string): string {
  return userId < targetUserId ? `${userId}:${targetUserId}` : `${targetUserId}:${userId}`;
}

// 맞팔 쌍과 표시 이름만 들고 친구 판정을 돌려준다. 캐시가 없어 current와 캐시 경로가 같은 값을 준다
export class StubFollowReader extends FollowReaderPort {
  readonly #mutualPairs = new Set<string>();
  readonly #displayNames = new Map<string, string>();

  addMutual(userId: string, targetUserId: string): void {
    this.#mutualPairs.add(pairKey(userId, targetUserId));
  }

  removeMutual(userId: string, targetUserId: string): void {
    this.#mutualPairs.delete(pairKey(userId, targetUserId));
  }

  setDisplayName(userId: string, name: string): void {
    this.#displayNames.set(userId, name);
  }

  async isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
    return this.#mutualPairs.has(pairKey(userId, targetUserId));
  }

  async isCurrentMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
    return this.#mutualPairs.has(pairKey(userId, targetUserId));
  }

  async countFriends(userId: string): Promise<number> {
    return (await this.getMutualFriendIds(userId)).length;
  }

  async getUserDisplayName(userId: string): Promise<string> {
    return this.#displayNames.get(userId) ?? userId;
  }

  async getMutualFriendIds(userId: string): Promise<string[]> {
    return [...this.#mutualPairs].flatMap((pair) => {
      const [left = "", right = ""] = pair.split(":");
      if (left === userId) {
        return [right];
      }
      return right === userId ? [left] : [];
    });
  }

  async getCurrentMutualFriendIds(userId: string): Promise<string[]> {
    return this.getMutualFriendIds(userId);
  }
}
