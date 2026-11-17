import { clampPageSize, type CursorPage, toCursorPage } from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { FriendshipId } from "../../domain/friendship-id.vo.js";
import type { FriendReaderPort } from "../ports/friend.reader.port.js";
import type { MutualFriendReaderPort } from "../ports/mutual-friend.reader.port.js";
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
  readonly friendReader: Pick<FriendReaderPort, "listFriends">;
  // 전체 친구 수는 검색어와 상관없이 캐시한 친구 수다
  readonly mutualFriendReader: Pick<MutualFriendReaderPort, "countFriends">;
}

export class GetFriendsUseCase {
  readonly #dependencies: GetFriendsDependencies;

  constructor(dependencies: GetFriendsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetFriendsQuery): Promise<GetFriendsResult> {
    const { friendReader, mutualFriendReader } = this.#dependencies;
    const size = clampPageSize(query.size);
    const userId = UserId.reconstitute(query.userId);
    const [friends, totalCount] = await Promise.all([
      friendReader.listFriends({
        userId,
        afterFriendshipId: query.cursor == null ? null : FriendshipId.reconstitute(query.cursor),
        tagSearch: query.search ?? null,
        limit: size + 1,
      }),
      mutualFriendReader.countFriends(userId),
    ]);
    return {
      page: toCursorPage({ rows: friends, size, toCursor: (friend) => friend.friendshipId }),
      totalCount,
    };
  }
}
