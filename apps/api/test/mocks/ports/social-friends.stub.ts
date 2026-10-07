import { ErrorCode } from "@aido/api/errors";

import type { FollowCachePort } from "#api/modules/social/application/ports/friends/follow-cache.port";
import type {
  FollowNotifierPort,
  FollowNewNotification,
  FollowMutualNotification,
  FirstFriendMilestoneNotification,
} from "#api/modules/social/application/ports/friends/follow-notifier.port";
import type {
  FollowRepositoryPort,
  FollowRecord,
  FollowUserBrief,
  FollowWithUser,
  FindFollowsParams,
  CreateFollowInput,
  UpdateFollowInput,
  UserSearchResult,
} from "#api/modules/social/application/ports/friends/follow.repository.port";
import { Friendship } from "#api/modules/social/domain/aggregates/friends/friendship.aggregate";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { FollowFixture } from "#test/fixtures/friend.fixture";

export class StubFollowRepository implements FollowRepositoryPort {
  readonly users = new Map<string, FollowUserBrief>();
  readonly follows = new Map<string, FollowRecord>();
  searchResults: UserSearchResult[] = [];
  searchTotal = 0;

  seed(
    input: Partial<FollowRecord> & Pick<FollowRecord, "followerId" | "followingId">,
  ): FollowRecord {
    const record = FollowFixture.create(input);
    this.follows.set(record.id, structuredClone(record));
    return structuredClone(record);
  }

  async create(input: CreateFollowInput): Promise<Friendship> {
    if (await this.findByFollowerAndFollowing(input.followerId, input.followingId)) {
      throw new ApplicationException(ErrorCode.FOLLOW_0901);
    }
    return Friendship.reconstitute(this.seed(input));
  }

  async findByFollowerAndFollowing(
    followerId: string,
    followingId: string,
  ): Promise<Friendship | null> {
    const record = [...this.follows.values()].find(
      (follow) => follow.followerId === followerId && follow.followingId === followingId,
    );
    return record ? Friendship.reconstitute(record) : null;
  }

  async findByIdWithUser(id: string): Promise<FollowWithUser | null> {
    const record = this.follows.get(id);
    if (!record) return null;
    const follower = this.users.get(record.followerId);
    const following = this.users.get(record.followingId);
    return follower && following ? structuredClone({ ...record, follower, following }) : null;
  }

  async update(id: string, input: UpdateFollowInput): Promise<Friendship> {
    const record = this.follows.get(id);
    if (!record) throw new ApplicationException(ErrorCode.FOLLOW_0903);
    const next = { ...record, ...input, updatedAt: now() };
    this.follows.set(id, structuredClone(next));
    return Friendship.reconstitute(next);
  }

  async updateByFollowerAndFollowing(
    followerId: string,
    followingId: string,
    input: UpdateFollowInput,
  ): Promise<Friendship> {
    const follow = await this.findByFollowerAndFollowing(followerId, followingId);
    if (!follow) throw new ApplicationException(ErrorCode.FOLLOW_0903);
    return this.update(follow.id, input);
  }

  async delete(id: string): Promise<void> {
    this.follows.delete(id);
  }

  async findMutualFriends(input: FindFollowsParams): Promise<FollowWithUser[]> {
    return this.#projections(
      [...this.follows.values()].filter(
        (record) => record.followerId === input.userId && record.status === "ACCEPTED",
      ),
    );
  }
  async findReceivedRequests(input: FindFollowsParams): Promise<FollowWithUser[]> {
    return this.#projections(
      [...this.follows.values()].filter(
        (record) => record.followingId === input.userId && record.status === "PENDING",
      ),
    );
  }
  async findSentRequests(input: FindFollowsParams): Promise<FollowWithUser[]> {
    return this.#projections(
      [...this.follows.values()].filter(
        (record) => record.followerId === input.userId && record.status === "PENDING",
      ),
    );
  }
  async searchUsers(): Promise<UserSearchResult[]> {
    return structuredClone(this.searchResults);
  }
  async countSearchUsers(): Promise<number> {
    return this.searchTotal;
  }

  async findAcceptedByIdAndFollowerId(id: string, followerId: string): Promise<Friendship | null> {
    const record = this.follows.get(id);
    return record?.followerId === followerId && record.status === "ACCEPTED"
      ? Friendship.reconstitute(record)
      : null;
  }
  async getMaxSortOrderForFriends(followerId: string): Promise<number> {
    return Math.max(
      -1,
      ...[...this.follows.values()]
        .filter((record) => record.followerId === followerId && record.status === "ACCEPTED")
        .map((record) => record.sortOrder),
    );
  }
  async shiftFriendSortOrders(
    followerId: string,
    fromSortOrder: number,
    toSortOrder: number | null,
    delta: number,
  ): Promise<number> {
    let count = 0;
    for (const [id, record] of this.follows) {
      if (
        record.followerId === followerId &&
        record.status === "ACCEPTED" &&
        record.sortOrder >= fromSortOrder &&
        (toSortOrder === null || record.sortOrder <= toSortOrder)
      ) {
        this.follows.set(id, { ...record, sortOrder: record.sortOrder + delta });
        count += 1;
      }
    }
    return count;
  }
  async updateFollowSortOrder(id: string, sortOrder: number): Promise<FollowWithUser> {
    await this.update(id, { sortOrder });
    const result = await this.findByIdWithUser(id);
    if (!result) throw new ApplicationException(ErrorCode.FOLLOW_0910);
    return result;
  }
  async isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
    const direct = await this.findByFollowerAndFollowing(userId, targetUserId);
    const reverse = await this.findByFollowerAndFollowing(targetUserId, userId);
    return direct?.isAccepted() === true && reverse?.isAccepted() === true;
  }
  async countMutualFriends(userId: string): Promise<number> {
    return (await this.getMutualFriendIds(userId)).length;
  }
  async countReceivedRequests(userId: string): Promise<number> {
    return [...this.follows.values()].filter(
      (record) => record.followingId === userId && record.status === "PENDING",
    ).length;
  }
  async countSentRequests(userId: string): Promise<number> {
    return [...this.follows.values()].filter(
      (record) => record.followerId === userId && record.status === "PENDING",
    ).length;
  }
  async userExists(userId: string): Promise<boolean> {
    return this.users.has(userId);
  }
  async getUserDisplayName(userId: string): Promise<string> {
    const user = this.users.get(userId);
    return user?.profile?.name ?? user?.userTag ?? "";
  }
  async findUserByTag(userTag: string): Promise<{ id: string } | null> {
    const user = [...this.users.values()].find((user) => user.userTag === userTag);
    return user ? { id: user.id } : null;
  }
  async getMutualFriendIds(userId: string): Promise<string[]> {
    const ids: string[] = [];
    for (const record of this.follows.values()) {
      if (record.followerId === userId && (await this.isMutualFriend(userId, record.followingId)))
        ids.push(record.followingId);
    }
    return ids;
  }
  async #projections(records: FollowRecord[]): Promise<FollowWithUser[]> {
    const projections = await Promise.all(
      records
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((record) => this.findByIdWithUser(record.id)),
    );
    return projections.filter((record) => record !== null);
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
