import type { PaginationService } from "#api/shared/application/pagination/index";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { normalizeUserSearchQuery } from "../../../domain/policies/friends/user-search-query.policy.js";
import { SocialFriendLogEvent } from "../../observability/friends/social-friend-log.events.js";
import {
  type FollowRepositoryPort,
  type UserSearchResult,
} from "../../ports/friends/follow.repository.port.js";
import { decodeSearchCursor, encodeSearchCursor } from "./search-cursor.js";

export interface SearchUsersInput {
  readonly viewerId: string;
  readonly query: string;
  readonly cursor?: string;
  readonly size?: number;
}

export interface SearchUsersOutput {
  readonly items: UserSearchResult[];
  readonly totalCount: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

interface SearchUsersDependencies {
  readonly followRepository: Pick<FollowRepositoryPort, "searchUsers" | "countSearchUsers">;
  readonly paginationService: PaginationService;
  readonly logger: ApplicationLogger;
}

export class SearchUsers {
  readonly #dependencies: SearchUsersDependencies;

  constructor(dependencies: SearchUsersDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SearchUsersInput): Promise<SearchUsersOutput> {
    const { nfc, upperTag } = normalizeUserSearchQuery(input.query);

    const { size } = this.#dependencies.paginationService.normalizeCursorPagination<string>({
      size: input.size,
    });

    const cursor = input.cursor !== undefined ? decodeSearchCursor(input.cursor) : undefined;

    const [rows, totalCount] = await Promise.all([
      this.#dependencies.followRepository.searchUsers({
        viewerId: input.viewerId,
        nfcQuery: nfc,
        upperTag,
        cursor,
        size,
      }),
      this.#dependencies.followRepository.countSearchUsers({
        viewerId: input.viewerId,
        nfcQuery: nfc,
        upperTag,
      }),
    ]);

    const hasMore = rows.length > size;
    const items = hasMore ? rows.slice(0, size) : rows;
    const last = items.at(-1);
    const nextCursor =
      hasMore && last !== undefined ? encodeSearchCursor({ rank: last.rank, id: last.id }) : null;

    this.#dependencies.logger.debug({
      event: SocialFriendLogEvent.SEARCHED,
      viewerId: input.viewerId,
      resultCount: items.length,
    });

    return { items, totalCount, hasMore, nextCursor };
  }
}
