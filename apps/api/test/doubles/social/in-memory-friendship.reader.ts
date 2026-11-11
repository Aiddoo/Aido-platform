import { FriendshipReaderPort } from "#api/modules/social/friends/application/ports/friendship.reader.port";
import type {
  FriendReadModel,
  FriendRequestReadModel,
} from "#api/modules/social/friends/application/read-models/friend.read-model";
import type { FriendshipId } from "#api/modules/social/friends/domain/friendship-id.vo";
import type { Friendship } from "#api/modules/social/friends/domain/friendship.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InMemoryFollowRepository } from "./in-memory-follow.repository.js";
import type { InMemoryFriendProfileReader } from "./in-memory-friend-profile.reader.js";

function compareIds(left: Friendship, right: Friendship): number {
  return left.id.value < right.id.value ? -1 : Number(left.id.value > right.id.value);
}

// Drizzle 조회와 같은 순서로 같은 저장소 상태를 읽는다. 사용자 요약이 없는 관계는 FK가 없는 행처럼 뺀다
export class InMemoryFriendshipReader extends FriendshipReaderPort {
  readonly #followRepository: InMemoryFollowRepository;
  readonly #profileReader: InMemoryFriendProfileReader;

  constructor(
    followRepository: InMemoryFollowRepository,
    profileReader: InMemoryFriendProfileReader,
  ) {
    super();
    this.#followRepository = followRepository;
    this.#profileReader = profileReader;
  }

  async listFriends(params: {
    readonly userId: UserId;
    readonly afterFriendshipId: FriendshipId | null;
    readonly tagSearch: string | null;
    readonly limit: number;
  }): Promise<FriendReadModel[]> {
    const { userId, afterFriendshipId, tagSearch, limit } = params;
    const all = this.#followRepository.listAll();
    const anchor = afterFriendshipId == null ? null : this.#findById(all, afterFriendshipId);
    if (afterFriendshipId != null && anchor == null) {
      return [];
    }

    const friends: FriendReadModel[] = [];
    const candidates = all
      .filter(
        (friendship) =>
          friendship.followerId.equals(userId) &&
          friendship.isAccepted() &&
          !friendship.followingId.equals(userId),
      )
      .toSorted((left, right) => left.sortOrder - right.sortOrder || compareIds(left, right))
      .filter(
        (friendship) =>
          anchor == null ||
          friendship.sortOrder > anchor.sortOrder ||
          (friendship.sortOrder === anchor.sortOrder && compareIds(friendship, anchor) > 0),
      );
    for (const friendship of candidates) {
      const isMutual = await this.#followRepository.existsMutualFriendship(
        userId,
        friendship.followingId,
      );
      const friend = this.#toFriend(friendship);
      const isMatched =
        tagSearch == null ||
        friend?.user.userTag.toLowerCase().includes(tagSearch.toLowerCase()) === true;
      if (isMutual && friend != null && isMatched) {
        friends.push(friend);
      }
    }
    return friends.slice(0, limit);
  }

  async findFriendById(friendshipId: FriendshipId): Promise<FriendReadModel | null> {
    const friendship = this.#findById(this.#followRepository.listAll(), friendshipId);
    return friendship == null ? null : this.#toFriend(friendship);
  }

  async listReceivedRequests(params: {
    readonly userId: UserId;
    readonly afterFriendshipId: FriendshipId | null;
    readonly limit: number;
  }): Promise<FriendRequestReadModel[]> {
    return this.#listRequests(params, (friendship) => ({
      isOwned: friendship.followingId.equals(params.userId),
      counterpartId: friendship.followerId.value,
    }));
  }

  async listSentRequests(params: {
    readonly userId: UserId;
    readonly afterFriendshipId: FriendshipId | null;
    readonly limit: number;
  }): Promise<FriendRequestReadModel[]> {
    return this.#listRequests(params, (friendship) => ({
      isOwned: friendship.followerId.equals(params.userId),
      counterpartId: friendship.followingId.value,
    }));
  }

  async countReceivedRequests(userId: UserId): Promise<number> {
    return this.#followRepository
      .listAll()
      .filter((friendship) => friendship.isPending() && friendship.followingId.equals(userId))
      .length;
  }

  async countSentRequests(userId: UserId): Promise<number> {
    return this.#followRepository
      .listAll()
      .filter((friendship) => friendship.isPending() && friendship.followerId.equals(userId))
      .length;
  }

  #listRequests(
    params: { readonly afterFriendshipId: FriendshipId | null; readonly limit: number },
    toSide: (friendship: Friendship) => { isOwned: boolean; counterpartId: string },
  ): FriendRequestReadModel[] {
    const all = this.#followRepository.listAll();
    const anchor =
      params.afterFriendshipId == null ? null : this.#findById(all, params.afterFriendshipId);
    if (params.afterFriendshipId != null && anchor == null) {
      return [];
    }
    return all
      .filter((friendship) => friendship.isPending() && toSide(friendship).isOwned)
      .toSorted(
        (left, right) =>
          Temporal.Instant.compare(right.createdAt, left.createdAt) || compareIds(right, left),
      )
      .filter(
        (friendship) =>
          anchor == null ||
          Temporal.Instant.compare(friendship.createdAt, anchor.createdAt) < 0 ||
          (friendship.createdAt.equals(anchor.createdAt) && compareIds(friendship, anchor) < 0),
      )
      .flatMap((friendship) => {
        const user = this.#profileReader.findUser(toSide(friendship).counterpartId);
        return user == null
          ? []
          : [{ friendshipId: friendship.id.value, user, requestedAt: friendship.createdAt }];
      })
      .slice(0, params.limit);
  }

  #findById(all: readonly Friendship[], friendshipId: FriendshipId): Friendship | null {
    return all.find((friendship) => friendship.id.equals(friendshipId)) ?? null;
  }

  #toFriend(friendship: Friendship): FriendReadModel | null {
    const user = this.#profileReader.findUser(friendship.followingId.value);
    return user == null
      ? null
      : { friendshipId: friendship.id.value, user, friendsSince: friendship.updatedAt };
  }
}
