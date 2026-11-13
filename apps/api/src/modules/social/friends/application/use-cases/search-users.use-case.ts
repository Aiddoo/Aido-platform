import { clampPageSize, type CursorPage, toCursorPage } from "#api/shared/application/cursor-page";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { UserSearchCursor } from "../../domain/user-search-cursor.vo.js";
import { UserSearchTerm } from "../../domain/user-search-term.vo.js";
import { FriendLogEvent } from "../friends.log-events.js";
import type { FriendSearchReaderPort } from "../ports/friend-search.reader.port.js";
import type { UserSearchResultReadModel } from "../read-models/user-search-result.read-model.js";

export interface SearchUsersQuery {
  readonly viewerId: string;
  readonly query: string;
  readonly cursor?: string;
  readonly size?: number;
}

export interface SearchUsersResult {
  readonly page: CursorPage<UserSearchResultReadModel, string>;
  readonly totalCount: number;
}

export interface SearchUsersDependencies {
  readonly searchReader: Pick<FriendSearchReaderPort, "searchUsers" | "countUsers">;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class SearchUsersUseCase {
  readonly #dependencies: SearchUsersDependencies;

  constructor(dependencies: SearchUsersDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: SearchUsersQuery): Promise<SearchUsersResult> {
    const { searchReader, logger } = this.#dependencies;
    // 검색어를 커서보다 먼저 검사한다(출시 앱이 받는 오류 우선순위)
    const term = UserSearchTerm.create(query.query);
    const size = clampPageSize(query.size);
    const cursor = query.cursor == null ? null : UserSearchCursor.create(query.cursor);
    const viewerId = UserId.reconstitute(query.viewerId);

    // 다음 쪽은 첫 쪽에서 센 총수를 커서에서 받아 다시 세지 않는다. 총수 없는 옛 커서만 다시 센다
    const [results, totalCount] = await Promise.all([
      searchReader.searchUsers({
        viewerId,
        term,
        after: cursor?.position ?? null,
        limit: size + 1,
      }),
      cursor?.totalCount ?? searchReader.countUsers({ viewerId, term }),
    ]);
    const page = toCursorPage({
      rows: results,
      size,
      toCursor: (result) =>
        UserSearchCursor.reconstitute({
          position: { rank: result.rank, id: result.user.id },
          totalCount,
        }).toString(),
    });

    logger.debug({
      event: FriendLogEvent.SEARCHED,
      viewerId: query.viewerId,
      resultCount: page.items.length,
    });
    return { page, totalCount };
  }
}
