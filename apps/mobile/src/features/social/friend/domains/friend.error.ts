import { friendLimitErrorDetailsSchema } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

export const FRIEND_ERROR_CODE = {
  INVALID_TAG: 'FRIEND_INVALID_TAG',
  EMPTY_TAG: 'FRIEND_EMPTY_TAG',
  SEARCH_QUERY_TOO_SHORT: 'FRIEND_SEARCH_QUERY_TOO_SHORT',
} as const;

export type FriendErrorCode = (typeof FRIEND_ERROR_CODE)[keyof typeof FRIEND_ERROR_CODE];

/** 친구 한도(FOLLOW_0909)에 서버가 실어 보낸 인원. 초대로 늘어난 자리를 반영한다. 없으면 null */
export function findFriendLimit(error: unknown) {
  if (!isApiError(error)) {
    return null;
  }
  const parsed = friendLimitErrorDetailsSchema.safeParse(error.details);

  return parsed.success ? parsed.data.limit : null;
}
