import type { PaginationService } from "#api/shared/application/pagination/index";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { normalizeUserSearchQuery } from "../../../domain/services/friends/user-search-query.js";
import {
  type FollowRepositoryPort,
  type UserSearchResult,
} from "../../ports/friends/follow.repository.port.js";
import { decodeSearchCursor, encodeSearchCursor } from "./search-cursor.js";

/** 사용자 검색 입력 (정규화 전 원본 검색어). */
export interface SearchUsersInput {
  viewerId: string;
  query: string;
  cursor?: string;
  size?: number;
}

/** 사용자 검색 결과 (관련도 순 + 커서 페이지네이션). */
export interface SearchUsersOutput {
  items: UserSearchResult[];
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * SearchUsers — 이름 또는 태그로 전체 활성 사용자 검색.
 *
 * 검색어를 NFC 정규화하고, 불투명 (rank,id) 커서를 디코딩해 keyset 페이지네이션한다.
 * 관계 flag는 저장소에서 단일 쿼리로 도출한다(N+1 없음).
 */
interface SearchUsersDependencies {
  readonly followRepository: FollowRepositoryPort;
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

    const cursor = input.cursor != null ? decodeSearchCursor(input.cursor) : undefined;

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
      hasMore && last != null ? encodeSearchCursor({ rank: last.rank, id: last.id }) : null;

    this.#dependencies.logger.debug(
      `User search: ${items.length} items for viewer: ${input.viewerId}`,
    );

    return { items, totalCount, hasMore, nextCursor };
  }
}
