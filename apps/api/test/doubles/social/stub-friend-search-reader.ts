import { FriendSearchReaderPort } from "#api/modules/social/friends/application/ports/friend-search.reader.port";
import type { UserSearchResultReadModel } from "#api/modules/social/friends/application/read-models/user-search-result.read-model";
import type { UserSearchCursor } from "#api/modules/social/friends/application/user-search-cursor.mapper";
import type { UserSearchTerm } from "#api/modules/social/friends/domain/user-search-term.vo";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface RecordedFriendSearch {
  readonly viewerId: string;
  readonly term: string;
  readonly upperTag: string;
  readonly after: UserSearchCursor | null;
  readonly limit: number;
}

// 검색 순위 SQL은 integration이 지키고, 여기서는 정해 둔 결과를 주며 받은 조건을 남긴다
export class StubFriendSearchReader extends FriendSearchReaderPort {
  readonly searches: RecordedFriendSearch[] = [];
  countCalls = 0;
  readonly #results: readonly UserSearchResultReadModel[];
  readonly #totalCount: number;

  constructor(results: readonly UserSearchResultReadModel[] = [], totalCount = results.length) {
    super();
    this.#results = results;
    this.#totalCount = totalCount;
  }

  async searchUsers(params: {
    readonly viewerId: UserId;
    readonly term: UserSearchTerm;
    readonly after: UserSearchCursor | null;
    readonly limit: number;
  }): Promise<UserSearchResultReadModel[]> {
    this.searches.push({
      viewerId: params.viewerId.value,
      term: params.term.value,
      upperTag: params.term.upperTag,
      after: params.after,
      limit: params.limit,
    });
    return this.#results.slice(0, params.limit);
  }

  async countUsers(): Promise<number> {
    this.countCalls += 1;
    return this.#totalCount;
  }
}
