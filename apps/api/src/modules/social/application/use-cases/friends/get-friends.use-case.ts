import type { PaginationService } from "#api/shared/application/pagination/index";

import type {
  FollowRepositoryPort,
  FollowWithUser,
} from "../../ports/friends/follow.repository.port.js";
import type { FollowReader } from "../../services/friends/follow.reader.js";

export interface GetFriendsInput {
  readonly userId: string;
  readonly cursor?: string;
  readonly size?: number;
  readonly search?: string;
}

export interface GetFriendsResult {
  readonly items: FollowWithUser[];
  readonly totalCount: number;
  readonly hasMore: boolean;
}

interface GetFriendsDependencies {
  readonly followRepository: Pick<FollowRepositoryPort, "findMutualFriends">;
  readonly paginationService: PaginationService;
  readonly reader: Pick<FollowReader, "countFriends">;
}

export class GetFriends {
  readonly #dependencies: GetFriendsDependencies;

  constructor(dependencies: GetFriendsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetFriendsInput): Promise<GetFriendsResult> {
    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<string>(
      {
        cursor: input.cursor,
        size: input.size,
      },
    );
    const [items, totalCount] = await Promise.all([
      this.#dependencies.followRepository.findMutualFriends({
        userId: input.userId,
        cursor,
        size,
        search: input.search,
      }),
      this.#dependencies.reader.countFriends(input.userId),
    ]);
    const page = this.#dependencies.paginationService.createCursorPaginatedResponse<
      FollowWithUser,
      string
    >({ items, size });
    return { items: page.items, totalCount, hasMore: page.pagination.hasNext };
  }
}
