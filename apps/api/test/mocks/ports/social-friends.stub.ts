import type { FollowCachePort } from "#api/modules/social/friends/application/ports/follow-cache.port";
import type {
  FollowNotifierPort,
  FollowNewNotification,
  FollowMutualNotification,
  FirstFriendMilestoneNotification,
} from "#api/modules/social/friends/application/ports/follow-notifier.port";
import type { UserBriefRow } from "#api/modules/social/friends/infrastructure/persistence/user-brief-relation.constants";
import { FollowFixture } from "#test/fixtures/friend.fixture";
import type { Follow } from "#test/types/database-rows";

// 옮기지 않은 social slice spec이 친구 관계 seed로만 쓰는 옛 stub이다. friends spec은 InMemory 저장소를 쓴다
export class StubFollowRepository {
  readonly users = new Map<string, UserBriefRow>();
  readonly follows = new Map<string, Follow>();

  seed(input: Partial<Follow> & Pick<Follow, "followerId" | "followingId">): Follow {
    const record = FollowFixture.create(input);
    this.follows.set(record.id, structuredClone(record));
    return structuredClone(record);
  }

  async isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
    const direct = this.#find(userId, targetUserId);
    const reverse = this.#find(targetUserId, userId);
    return direct?.status === "ACCEPTED" && reverse?.status === "ACCEPTED";
  }

  async countMutualFriends(userId: string): Promise<number> {
    return (await this.getMutualFriendIds(userId)).length;
  }

  async getUserDisplayName(userId: string): Promise<string> {
    const user = this.users.get(userId);
    return user?.profile?.name ?? user?.userTag ?? "";
  }

  async getMutualFriendIds(userId: string): Promise<string[]> {
    const ids: string[] = [];
    for (const record of this.follows.values()) {
      if (record.followerId === userId && (await this.isMutualFriend(userId, record.followingId))) {
        ids.push(record.followingId);
      }
    }
    return ids;
  }

  #find(followerId: string, followingId: string): Follow | undefined {
    return [...this.follows.values()].find(
      (follow) => follow.followerId === followerId && follow.followingId === followingId,
    );
  }
}

export class StubFollowCache implements FollowCachePort {
  readonly mutual = new Map<string, boolean>();
  readonly friendIds = new Map<string, string[]>();
  readonly friendCounts = new Map<string, number>();
  #pair(userId: string, targetUserId: string): string {
    return [userId, targetUserId].sort().join(":");
  }
  async getMutualFriend(userId: string, targetUserId: string): Promise<boolean | undefined> {
    return this.mutual.get(this.#pair(userId, targetUserId));
  }
  async setMutualFriend(userId: string, targetUserId: string, value: boolean): Promise<void> {
    this.mutual.set(this.#pair(userId, targetUserId), value);
  }
  async invalidateMutualFriend(userId: string, targetUserId: string): Promise<void> {
    this.mutual.delete(this.#pair(userId, targetUserId));
  }
  async wrapMutualFriendIds(userId: string, factory: () => Promise<string[]>): Promise<string[]> {
    let ids = this.friendIds.get(userId);
    if (ids === undefined) {
      ids = await factory();
      this.friendIds.set(userId, [...ids]);
    }
    return [...ids];
  }
  async invalidateMutualFriendIds(userId: string): Promise<void> {
    this.friendIds.delete(userId);
  }
  async wrapFriendCount(userId: string, factory: () => Promise<number>): Promise<number> {
    let count = this.friendCounts.get(userId);
    if (count === undefined) {
      count = await factory();
      this.friendCounts.set(userId, count);
    }
    return count;
  }
  async invalidateFriendCount(userId: string): Promise<void> {
    this.friendCounts.delete(userId);
  }
}

export class StubFollowNotifier implements FollowNotifierPort {
  readonly newRequests: FollowNewNotification[] = [];
  readonly mutual: FollowMutualNotification[] = [];
  readonly milestones: FirstFriendMilestoneNotification[] = [];
  notifyFollowNew(input: FollowNewNotification): void {
    this.newRequests.push({ ...input });
  }
  notifyFollowMutual(input: FollowMutualNotification): void {
    this.mutual.push({ ...input });
  }
  notifyFirstFriendMilestone(input: FirstFriendMilestoneNotification): void {
    this.milestones.push({ ...input });
  }
}
