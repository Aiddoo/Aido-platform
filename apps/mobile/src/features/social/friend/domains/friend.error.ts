import { friendLimitErrorDetailsSchema } from '@aido/api/errors';
import { PREMIUM_FEATURES } from '@aido/api/vocabulary';
import { isApiError } from '@src/shared/errors';

interface FriendLimitInput {
  /** 친구 한도(FOLLOW_0909) 오류가 알려 준 인원 */
  serverLimit: number | null;
  /** 내 정보(entitlements)의 친구 한도 */
  knownLimit: number | null;
}

/** 친구 한도(FOLLOW_0909)에 서버가 실어 보낸 인원. 초대로 늘어난 자리를 반영한다. 없으면 null */
export function findFriendLimit(error: unknown) {
  if (!isApiError(error)) {
    return null;
  }
  const parsed = friendLimitErrorDetailsSchema.safeParse(error.details);

  return parsed.success ? parsed.data.limit : null;
}

// 초대로 늘어난 자리는 서버 오류가 알려 주고, 없으면 내 정보, 그것도 없으면 카탈로그의 무료 한도다
export function getFriendLimit({ serverLimit, knownLimit }: FriendLimitInput) {
  return serverLimit ?? knownLimit ?? PREMIUM_FEATURES.FRIEND.free;
}
