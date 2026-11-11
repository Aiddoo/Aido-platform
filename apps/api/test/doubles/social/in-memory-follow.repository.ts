import { friendRequestAlreadySent } from "#api/modules/social/friends/application/friends.errors";
import { FollowRepositoryPort } from "#api/modules/social/friends/application/ports/follow.repository.port";
import type { SortOrderShift } from "#api/modules/social/friends/domain/friend-ordering.domain-service";
import { FriendshipId } from "#api/modules/social/friends/domain/friendship-id.vo";
import { Friendship } from "#api/modules/social/friends/domain/friendship.aggregate";
import { createEntityId } from "#api/platform/database/entity-id";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 저장 사본을 두어 save 없이 바꾼 Aggregate가 저장소 상태로 새지 않게 한다
function copyOf(friendship: Friendship): Friendship {
  return Friendship.reconstitute(friendship.toPrimitives());
}

export class InMemoryFollowRepository extends FollowRepositoryPort {
  readonly #friendships = new Map<string, Friendship>();

  constructor(friendships: readonly Friendship[] = []) {
    super();
    for (const friendship of friendships) {
      this.#friendships.set(friendship.id.value, copyOf(friendship));
    }
  }

  get size(): number {
    return this.#friendships.size;
  }

  // InMemory 조회 대역이 같은 상태를 읽도록 연다(저장 순서)
  listAll(): Friendship[] {
    return [...this.#friendships.values()].map(copyOf);
  }

  async nextId(): Promise<FriendshipId> {
    return FriendshipId.reconstitute(createEntityId());
  }

  async findByFollowerAndFollowing(
    followerId: UserId,
    followingId: UserId,
  ): Promise<Friendship | null> {
    const found = this.#find(followerId.value, followingId.value);
    return found == null ? null : copyOf(found);
  }

  async findAcceptedByIdAndFollowerId(
    friendshipId: FriendshipId,
    followerId: UserId,
  ): Promise<Friendship | null> {
    const found = this.#friendships.get(friendshipId.value);
    return found != null && found.isAccepted() && found.followerId.equals(followerId)
      ? copyOf(found)
      : null;
  }

  async findMaxFriendSortOrder(followerId: UserId): Promise<number | null> {
    const sortOrders = this.#acceptedOf(followerId.value).map((friendship) => friendship.sortOrder);
    return sortOrders.length === 0 ? null : Math.max(...sortOrders);
  }

  async countMutualFriends(userId: UserId): Promise<number> {
    return this.#mutualFriendIds(userId.value).length;
  }

  async existsMutualFriendship(userId: UserId, targetUserId: UserId): Promise<boolean> {
    return this.#isMutual(userId.value, targetUserId.value);
  }

  async listMutualFriendIds(userId: UserId): Promise<UserId[]> {
    return this.#acceptedOf(userId.value)
      .filter((friendship) => this.#isMutual(userId.value, friendship.followingId.value))
      .map((friendship) => friendship.followingId);
  }

  async shiftFriendSortOrders(
    followerId: UserId,
    shift: SortOrderShift,
    now: Temporal.Instant,
  ): Promise<void> {
    for (const friendship of this.#acceptedOf(followerId.value)) {
      const isInRange =
        shift.fromSortOrder <= friendship.sortOrder &&
        (shift.toSortOrder == null || friendship.sortOrder <= shift.toSortOrder);
      if (isInRange) {
        friendship.moveTo(friendship.sortOrder + shift.delta, now);
      }
    }
  }

  async save(friendship: Friendship): Promise<void> {
    const samePair = this.#find(friendship.followerId.value, friendship.followingId.value);
    if (samePair != null && !samePair.id.equals(friendship.id)) {
      throw friendRequestAlreadySent(friendship.followingId);
    }
    this.#friendships.set(friendship.id.value, copyOf(friendship));
  }

  async delete(friendship: Friendship): Promise<void> {
    this.#friendships.delete(friendship.id.value);
  }

  #find(followerId: string, followingId: string): Friendship | undefined {
    return [...this.#friendships.values()].find(
      (friendship) =>
        friendship.followerId.value === followerId && friendship.followingId.value === followingId,
    );
  }

  #acceptedOf(followerId: string): Friendship[] {
    return [...this.#friendships.values()].filter(
      (friendship) => friendship.followerId.value === followerId && friendship.isAccepted(),
    );
  }

  #isMutual(userId: string, targetUserId: string): boolean {
    return (
      this.#find(userId, targetUserId)?.isAccepted() === true &&
      this.#find(targetUserId, userId)?.isAccepted() === true
    );
  }

  #mutualFriendIds(userId: string): string[] {
    return this.#acceptedOf(userId)
      .filter((friendship) => this.#isMutual(userId, friendship.followingId.value))
      .map((friendship) => friendship.followingId.value);
  }
}
