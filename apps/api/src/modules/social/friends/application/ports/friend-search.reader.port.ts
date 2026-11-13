import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserSearchPosition } from "../../domain/user-search-cursor.vo.js";
import type { UserSearchTerm } from "../../domain/user-search-term.vo.js";
import type { UserSearchResultReadModel } from "../read-models/user-search-result.read-model.js";

// 이름·태그로 친구로 맺을 사용자를 찾는다. 본인·탈퇴·비활성(ACTIVE 외)·어느 쪽이든 차단한 사용자는 뺀다
export abstract class FriendSearchReaderPort {
  // rank·id 오름차순이고 after 다음부터 준다
  abstract searchUsers(params: {
    readonly viewerId: UserId;
    readonly term: UserSearchTerm;
    readonly after: UserSearchPosition | null;
    readonly limit: number;
  }): Promise<UserSearchResultReadModel[]>;
  abstract countUsers(params: {
    readonly viewerId: UserId;
    readonly term: UserSearchTerm;
  }): Promise<number>;
}
