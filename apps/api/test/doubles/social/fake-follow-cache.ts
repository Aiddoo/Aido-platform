import { FollowCachePort } from "#api/modules/social/friends/application/ports/follow-cache.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

function pairKey(user: UserId, target: UserId): string {
  const [userId, targetUserId] = [user.value, target.value];
  return userId < targetUserId ? `${userId}:${targetUserId}` : `${targetUserId}:${userId}`;
}

// 운영 어댑터처럼 값을 담고 지우며, 무엇을 지웠는지 남겨 무효화 범위를 확인할 수 있게 한다
export class FakeFollowCache extends FollowCachePort {
  readonly mutual = new Map<string, boolean>();
  readonly friendIds = new Map<string, string[]>();
  readonly friendCounts = new Map<string, number>();
  readonly invalidated: string[] = [];

  async getMutualFriend(smallerId: UserId, largerId: UserId): Promise<boolean | undefined> {
    return this.mutual.get(pairKey(smallerId, largerId));
  }

  async setMutualFriend(smallerId: UserId, largerId: UserId, isMutual: boolean): Promise<void> {
    this.mutual.set(pairKey(smallerId, largerId), isMutual);
  }

  async invalidateMutualFriend(userId: UserId, targetUserId: UserId): Promise<void> {
    this.mutual.delete(pairKey(userId, targetUserId));
    this.invalidated.push(`mutual:${pairKey(userId, targetUserId)}`);
  }

  async wrapMutualFriendIds(userId: UserId, factory: () => Promise<string[]>): Promise<string[]> {
    const cached = this.friendIds.get(userId.value);
    if (cached != null) {
      return [...cached];
    }
    const ids = await factory();
    this.friendIds.set(userId.value, [...ids]);
    return ids;
  }

  async invalidateMutualFriendIds(userId: UserId): Promise<void> {
    this.friendIds.delete(userId.value);
    this.invalidated.push(`ids:${userId.value}`);
  }

  async wrapFriendCount(userId: UserId, factory: () => Promise<number>): Promise<number> {
    const cached = this.friendCounts.get(userId.value);
    if (cached != null) {
      return cached;
    }
    const count = await factory();
    this.friendCounts.set(userId.value, count);
    return count;
  }

  async invalidateFriendCount(userId: UserId): Promise<void> {
    this.friendCounts.delete(userId.value);
    this.invalidated.push(`count:${userId.value}`);
  }
}
