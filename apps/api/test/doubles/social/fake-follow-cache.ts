import { FollowCachePort } from "#api/modules/social/friends/application/ports/follow-cache.port";

function pairKey(userId: string, targetUserId: string): string {
  return userId < targetUserId ? `${userId}:${targetUserId}` : `${targetUserId}:${userId}`;
}

// 운영 어댑터처럼 값을 담고 지우며, 무엇을 지웠는지 남겨 무효화 범위를 확인할 수 있게 한다
export class FakeFollowCache extends FollowCachePort {
  readonly mutual = new Map<string, boolean>();
  readonly friendIds = new Map<string, string[]>();
  readonly friendCounts = new Map<string, number>();
  readonly invalidated: string[] = [];

  async getMutualFriend(smallerId: string, largerId: string): Promise<boolean | undefined> {
    return this.mutual.get(pairKey(smallerId, largerId));
  }

  async setMutualFriend(smallerId: string, largerId: string, isMutual: boolean): Promise<void> {
    this.mutual.set(pairKey(smallerId, largerId), isMutual);
  }

  async invalidateMutualFriend(userId: string, targetUserId: string): Promise<void> {
    this.mutual.delete(pairKey(userId, targetUserId));
    this.invalidated.push(`mutual:${pairKey(userId, targetUserId)}`);
  }

  async wrapMutualFriendIds(userId: string, factory: () => Promise<string[]>): Promise<string[]> {
    const cached = this.friendIds.get(userId);
    if (cached != null) {
      return [...cached];
    }
    const ids = await factory();
    this.friendIds.set(userId, [...ids]);
    return ids;
  }

  async invalidateMutualFriendIds(userId: string): Promise<void> {
    this.friendIds.delete(userId);
    this.invalidated.push(`ids:${userId}`);
  }

  async wrapFriendCount(userId: string, factory: () => Promise<number>): Promise<number> {
    const cached = this.friendCounts.get(userId);
    if (cached != null) {
      return cached;
    }
    const count = await factory();
    this.friendCounts.set(userId, count);
    return count;
  }

  async invalidateFriendCount(userId: string): Promise<void> {
    this.friendCounts.delete(userId);
    this.invalidated.push(`count:${userId}`);
  }
}
