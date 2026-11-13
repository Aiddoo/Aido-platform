import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserTag } from "../../domain/user-tag.vo.js";
import { displayNameUserNotFound } from "../friends.errors.js";

// 친구 요청 대상은 탈퇴·비활성(ACTIVE 외)이 아닌 사용자만이다
export abstract class FriendProfileReaderPort {
  abstract existsActiveUser(userId: UserId): Promise<boolean>;
  abstract findActiveUserIdByTag(userTag: UserTag): Promise<UserId | null>;
  // 알림에 쓰는 이름이다. 프로필 이름, 없으면 Aido ID(userTag)이고 사용자가 없으면 null이다
  abstract findDisplayName(userId: UserId): Promise<string | null>;
}

// 알림을 보내는 사람은 방금 요청·완료한 사용자라 행이 있다. 없으면 userId를 이름으로 보내지 않고 데이터 오류로 본다
export async function readDisplayName(
  profileReader: Pick<FriendProfileReaderPort, "findDisplayName">,
  userId: UserId,
): Promise<string> {
  const displayName = await profileReader.findDisplayName(userId);
  if (displayName == null) {
    throw displayNameUserNotFound(userId);
  }
  return displayName;
}
