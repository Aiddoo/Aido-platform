import { clampPageSize, type CursorPage, toCursorPage } from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { FriendshipId } from "../../domain/friendship-id.vo.js";
import type { FriendshipReaderPort } from "../ports/friendship.reader.port.js";
import type { FriendRequestReadModel } from "../read-models/friend.read-model.js";

export interface GetReceivedFriendRequestsQuery {
  readonly userId: string;
  readonly cursor?: string;
  readonly size?: number;
}

export interface GetReceivedFriendRequestsResult {
  readonly page: CursorPage<FriendRequestReadModel, string>;
  readonly totalCount: number;
}

export interface GetReceivedFriendRequestsDependencies {
  readonly friendshipReader: Pick<
    FriendshipReaderPort,
    "listReceivedRequests" | "countReceivedRequests"
  >;
}

export class GetReceivedFriendRequestsUseCase {
  readonly #dependencies: GetReceivedFriendRequestsDependencies;

  constructor(dependencies: GetReceivedFriendRequestsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetReceivedFriendRequestsQuery): Promise<GetReceivedFriendRequestsResult> {
    const { friendshipReader } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const size = clampPageSize(query.size);
    const [requests, totalCount] = await Promise.all([
      friendshipReader.listReceivedRequests({
        userId,
        afterFriendshipId: query.cursor == null ? null : FriendshipId.reconstitute(query.cursor),
        limit: size + 1,
      }),
      friendshipReader.countReceivedRequests(userId),
    ]);
    return {
      page: toCursorPage({ rows: requests, size, toCursor: (request) => request.friendshipId }),
      totalCount,
    };
  }
}
