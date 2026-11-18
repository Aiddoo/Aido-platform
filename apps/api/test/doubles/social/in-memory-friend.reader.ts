import { FriendReaderPort } from "#api/modules/social/friendships/application/ports/friend.reader.port";
import type {
  FriendReadModel,
  FriendRelationReadModel,
  FriendRequestReadModel,
} from "#api/modules/social/friendships/application/read-models/friend.read-model";
import type { FriendshipId } from "#api/modules/social/friendships/domain/friendship-id.vo";
import type { Friendship } from "#api/modules/social/friendships/domain/friendship.aggregate";
import {
  type CursorPage,
  emptyCursorPage,
  toMappedCursorPage,
} from "#api/shared/application/cursor-page";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InMemoryFriendProfileReader } from "./in-memory-friend-profile.reader.js";
import type { InMemoryFriendshipRepository } from "./in-memory-friendship.repository.js";

function compareIds(left: Friendship, right: Friendship): number {
  return left.id.value < right.id.value ? -1 : Number(left.id.value > right.id.value);
}

// Drizzle 조회와 같은 순서로 같은 저장소 상태를 읽는다. 사용자 요약이 없는 관계는 FK가 없는 행처럼 뺀다
export class InMemoryFriendReader extends FriendReaderPort {
  readonly #friendshipRepository: InMemoryFriendshipRepository;
  readonly #profileReader: InMemoryFriendProfileReader;

  constructor(
    friendshipRepository: InMemoryFriendshipRepository,
    profileReader: InMemoryFriendProfileReader,
  ) {
    super();
    this.#friendshipRepository = friendshipRepository;
    this.#profileReader = profileReader;
  }

  async listFriends(params: {
    readonly userId: UserId;
    readonly afterFriendshipId: FriendshipId | null;
    readonly tagSearch: string | null;
    readonly size: number;
  }): Promise<CursorPage<FriendReadModel, string>> {
    const { userId, afterFriendshipId, tagSearch, size } = params;
    const all = this.#friendshipRepository.listAll();
    const anchor = afterFriendshipId == null ? null : this.#findById(all, afterFriendshipId);
    if (afterFriendshipId != null && anchor == null) {
      return emptyCursorPage(size);
    }

    const rows: Friendship[] = [];
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
      const isMutual = await this.#friendshipRepository.existsMutualFriendship(
        userId,
        friendship.followingId,
      );
      const isMatched =
        tagSearch == null ||
        this.#toFriend(friendship)?.user.userTag.toLowerCase().includes(tagSearch.toLowerCase()) ===
          true;
      if (isMutual && isMatched) {
        rows.push(friendship);
      }
    }
    return toMappedCursorPage({
      rows,
      size,
      toCursor: (friendship) => friendship.id.value,
      toItems: (pageRows) => pageRows.flatMap((friendship) => this.#toFriend(friendship) ?? []),
    });
  }

  async findFriendById(friendshipId: FriendshipId): Promise<FriendReadModel | null> {
    const friendship = this.#findById(this.#friendshipRepository.listAll(), friendshipId);
    return friendship == null ? null : this.#toFriend(friendship);
  }

  async listReceivedRequests(params: {
    readonly userId: UserId;
    readonly afterFriendshipId: FriendshipId | null;
    readonly size: number;
  }): Promise<CursorPage<FriendRequestReadModel, string>> {
    return this.#listRequests(params, (friendship) => ({
      isOwned: friendship.followingId.equals(params.userId),
      counterpartId: friendship.followerId.value,
    }));
  }

  async listSentRequests(params: {
    readonly userId: UserId;
    readonly afterFriendshipId: FriendshipId | null;
    readonly size: number;
  }): Promise<CursorPage<FriendRequestReadModel, string>> {
    return this.#listRequests(params, (friendship) => ({
      isOwned: friendship.followerId.equals(params.userId),
      counterpartId: friendship.followingId.value,
    }));
  }

  async countReceivedRequests(userId: UserId): Promise<number> {
    return this.#friendshipRepository
      .listAll()
      .filter((friendship) => friendship.isPending() && friendship.followingId.equals(userId))
      .length;
  }

  async countSentRequests(userId: UserId): Promise<number> {
    return this.#friendshipRepository
      .listAll()
      .filter((friendship) => friendship.isPending() && friendship.followerId.equals(userId))
      .length;
  }

  async findRelationsWith(
    viewerId: UserId,
    userIds: readonly UserId[],
  ): Promise<FriendRelationReadModel[]> {
    const all = this.#friendshipRepository.listAll();
    return userIds.map((userId) => {
      const outgoing = all.find(
        (friendship) =>
          friendship.followerId.equals(viewerId) && friendship.followingId.equals(userId),
      );
      const incoming = all.find(
        (friendship) =>
          friendship.followerId.equals(userId) && friendship.followingId.equals(viewerId),
      );
      return {
        userId: userId.value,
        isFollowing: outgoing?.isAccepted() === true,
        isFollower: incoming?.isAccepted() === true,
        isFriend: outgoing?.isAccepted() === true && incoming?.isAccepted() === true,
        isRequestPending: outgoing?.isPending() === true,
      };
    });
  }

  #listRequests(
    params: { readonly afterFriendshipId: FriendshipId | null; readonly size: number },
    toSide: (friendship: Friendship) => { isOwned: boolean; counterpartId: string },
  ): Promise<CursorPage<FriendRequestReadModel, string>> {
    const all = this.#friendshipRepository.listAll();
    const anchor =
      params.afterFriendshipId == null ? null : this.#findById(all, params.afterFriendshipId);
    if (params.afterFriendshipId != null && anchor == null) {
      return Promise.resolve(emptyCursorPage(params.size));
    }
    const rows = all
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
      );
    return toMappedCursorPage({
      rows,
      size: params.size,
      toCursor: (friendship) => friendship.id.value,
      toItems: (pageRows) =>
        pageRows.flatMap((friendship) => {
          const user = this.#profileReader.findUser(toSide(friendship).counterpartId);
          return user == null
            ? []
            : [{ friendshipId: friendship.id.value, user, requestedAt: friendship.createdAt }];
        }),
    });
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
