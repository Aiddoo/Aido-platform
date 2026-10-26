import type { PaginationService } from "#api/shared/application/pagination/index";

import type {
  BlockedUserRecord,
  UserBlockRepositoryPort,
} from "../../ports/blocks/user-block.repository.port.js";

export interface GetBlockedUsersInput {
  readonly blockerId: string;
  readonly cursor?: string;
  readonly size?: number;
}

export interface GetBlockedUsersResult {
  readonly items: BlockedUserRecord[];
  readonly totalCount: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

interface GetBlockedUsersDependencies {
  readonly userBlockRepository: Pick<
    UserBlockRepositoryPort,
    "findBlockedUsers" | "countBlockedUsers"
  >;
  readonly paginationService: Pick<
    PaginationService,
    "normalizeCursorPagination" | "createCursorPaginatedResponse"
  >;
}

export class GetBlockedUsers {
  readonly #dependencies: GetBlockedUsersDependencies;

  constructor(dependencies: GetBlockedUsersDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetBlockedUsersInput): Promise<GetBlockedUsersResult> {
    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<string>(
      { cursor: input.cursor, size: input.size },
    );
    const [items, totalCount] = await Promise.all([
      this.#dependencies.userBlockRepository.findBlockedUsers({
        blockerId: input.blockerId,
        cursor,
        size,
      }),
      this.#dependencies.userBlockRepository.countBlockedUsers(input.blockerId),
    ]);
    const page = this.#dependencies.paginationService.createCursorPaginatedResponse<
      BlockedUserRecord,
      string
    >({ items, size });
    return {
      items: page.items,
      totalCount,
      hasMore: page.pagination.hasNext,
      nextCursor: page.pagination.nextCursor,
    };
  }
}
