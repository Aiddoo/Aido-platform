import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserTag } from "../../domain/user-tag.vo.js";

// 친구 요청 대상은 탈퇴·비활성(ACTIVE 외)이 아닌 사용자만이다
export abstract class FriendProfileReaderPort {
  abstract existsActiveUser(userId: UserId): Promise<boolean>;
  abstract findActiveUserIdByTag(userTag: UserTag): Promise<UserId | null>;
  // 알림에 쓰는 이름이다. 프로필 이름, 없으면 태그이고 사용자가 없으면 null이다
  abstract findDisplayName(userId: UserId): Promise<string | null>;
}
