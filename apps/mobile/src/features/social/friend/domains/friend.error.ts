import { isApiError } from '@src/shared/errors';

export const FRIEND_ERROR_CODE = {
  INVALID_TAG: 'FRIEND_INVALID_TAG',
  EMPTY_TAG: 'FRIEND_EMPTY_TAG',
  SEARCH_QUERY_TOO_SHORT: 'FRIEND_SEARCH_QUERY_TOO_SHORT',
} as const;

export type FriendErrorCode = (typeof FRIEND_ERROR_CODE)[keyof typeof FRIEND_ERROR_CODE];

/** 서버가 오류와 함께 준 상세(친구 한도 등). 서버 오류가 아니면 없다 */
export function getFriendErrorDetails(error: unknown) {
  return isApiError(error) ? error.details : undefined;
}
