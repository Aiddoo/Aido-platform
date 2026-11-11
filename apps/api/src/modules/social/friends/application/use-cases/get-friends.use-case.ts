import { clampPageSize, type CursorPage, toCursorPage } from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { FriendshipId } from "../../domain/friendship-id.vo.js";
import type { FollowReaderPort } from "../ports/follow.reader.port.js";
import type { FriendshipReaderPort } from "../ports/friendship.reader.port.js";
import type { FriendReadModel } from "../read-models/friend.read-model.js";

export interface GetFriendsQuery {
  readonly userId: string;
  readonly cursor?: string;
  readonly size?: number;
  readonly search?: string;
}

export interface GetFriendsResult {
  readonly page: CursorPage<FriendReadModel, string>;
  readonly totalCount: number;
}

export interface GetFriendsDependencies {
  readonly friendshipReader: Pick<FriendshipReaderPort, "listFriends">;
  // 전체 친구 수는 검색어와 상관없이 캐시한 친구 수다
  readonly followReader: Pick<FollowReaderPort, "countFriends">;
}

export class GetFriendsUseCase {
  readonly #dependencies: GetFriendsDependencies;

  constructor(dependencies: GetFriendsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetFriendsQuery): Promise<GetFriendsResult> {
    const { friendshipReader, followReader } = this.#dependencies;
    const size = clampPageSize(query.size);
    const userId = UserId.reconstitute(query.userId);
    const [friends, totalCount] = await Promise.all([
      friendshipReader.listFriends({
        userId,
        afterFriendshipId: query.cursor == null ? null : FriendshipId.reconstitute(query.cursor),
        tagSearch: query.search ?? null,
        limit: size + 1,
      }),
      followReader.countFriends(userId),
    ]);
    return {
      page: toCursorPage({ rows: friends, size, toCursor: (friend) => friend.friendshipId }),
      totalCount,
    };
  }
}
