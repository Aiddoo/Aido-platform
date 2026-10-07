import type { PaginationService } from "#api/shared/application/pagination/index";

import type {
  FollowRepositoryPort,
  FollowWithUser,
} from "../../ports/friends/follow.repository.port.js";

export interface GetSentFriendRequestsInput {
  readonly userId: string;
  readonly cursor?: string;
  readonly size?: number;
}

export interface GetSentFriendRequestsResult {
  readonly items: FollowWithUser[];
  readonly totalCount: number;
  readonly hasMore: boolean;
}

interface GetSentFriendRequestsDependencies {
  readonly followRepository: Pick<FollowRepositoryPort, "findSentRequests" | "countSentRequests">;
  readonly paginationService: PaginationService;
}

export class GetSentFriendRequests {
  readonly #dependencies: GetSentFriendRequestsDependencies;

  constructor(dependencies: GetSentFriendRequestsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetSentFriendRequestsInput): Promise<GetSentFriendRequestsResult> {
    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<string>(
      {
        cursor: input.cursor,
        size: input.size,
      },
    );
    const [items, totalCount] = await Promise.all([
      this.#dependencies.followRepository.findSentRequests({
        userId: input.userId,
        cursor,
        size,
      }),
      this.#dependencies.followRepository.countSentRequests(input.userId),
    ]);
    const page = this.#dependencies.paginationService.createCursorPaginatedResponse<
      FollowWithUser,
      string
    >({ items, size });
    return { items: page.items, totalCount, hasMore: page.pagination.hasNext };
  }
}
