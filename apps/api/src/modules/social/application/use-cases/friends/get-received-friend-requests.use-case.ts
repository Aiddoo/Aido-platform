import type { PaginationService } from "#api/shared/application/pagination/index";

import type {
  FollowRepositoryPort,
  FollowWithUser,
} from "../../ports/friends/follow.repository.port.js";

export interface GetReceivedFriendRequestsInput {
  readonly userId: string;
  readonly cursor?: string;
  readonly size?: number;
}

export interface GetReceivedFriendRequestsResult {
  readonly items: FollowWithUser[];
  readonly totalCount: number;
  readonly hasMore: boolean;
}

interface GetReceivedFriendRequestsDependencies {
  readonly followRepository: Pick<
    FollowRepositoryPort,
    "findReceivedRequests" | "countReceivedRequests"
  >;
  readonly paginationService: PaginationService;
}

export class GetReceivedFriendRequests {
  readonly #dependencies: GetReceivedFriendRequestsDependencies;

  constructor(dependencies: GetReceivedFriendRequestsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetReceivedFriendRequestsInput): Promise<GetReceivedFriendRequestsResult> {
    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<string>(
      {
        cursor: input.cursor,
        size: input.size,
      },
    );
    const [items, totalCount] = await Promise.all([
      this.#dependencies.followRepository.findReceivedRequests({
        userId: input.userId,
        cursor,
        size,
      }),
      this.#dependencies.followRepository.countReceivedRequests(input.userId),
    ]);
    const page = this.#dependencies.paginationService.createCursorPaginatedResponse<
      FollowWithUser,
      string
    >({ items, size });
    return { items: page.items, totalCount, hasMore: page.pagination.hasNext };
  }
}
