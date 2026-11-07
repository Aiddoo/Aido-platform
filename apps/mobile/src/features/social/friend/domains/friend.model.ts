import { friendLimitErrorDetailsSchema } from '@aido/api/errors';
import { PREMIUM_FEATURES, USER_SEARCH_QUERY_LENGTH } from '@aido/api/vocabulary';

import { addFriendFormSchema } from '../schemas/add-friend-form.schema';
import type { SearchedUser } from '../schemas/friend.schema';

export type RequestState = 'friend' | 'pending' | 'none';

/** 친구 한도 안내에 덧붙일 "초대로 자리 늘리기" 길. 초대를 쓸 수 없으면 화면이 넘기지 않는다 */
export interface FriendLimitInvite {
  getDescription: (limit: number) => string;
  actionLabel: string;
  open: () => void;
}

export type FriendLimitDialog = { type: 'invite'; limit: number } | { type: 'subscribe' };

/** 서버 경로 검증(userTagParamSchema)과 같은 규칙이다 */
export function hasValidUserTag(user: Pick<SearchedUser, 'userTag'>) {
  return addFriendFormSchema.shape.userTag.safeParse(user.userTag.trim()).success;
}

export function hasValidSearchQuery(input: { query: string }) {
  return input.query.trim().length >= USER_SEARCH_QUERY_LENGTH.MIN;
}

/** 검색 결과의 사용자와 나 사이 요청 상태. 이미 친구면 요청 대기보다 먼저다 */
export function getRequestState(
  user: Pick<SearchedUser, 'isFriend' | 'requestPending'>,
): RequestState {
  if (user.isFriend) {
    return 'friend';
  }
  if (user.requestPending) {
    return 'pending';
  }

  return 'none';
}

/**
 * 친구 한도에 닿았을 때 안내할 인원. 초대로 늘어난 자리는 서버가 FOLLOW_0909 details.limit으로 알려 준다.
 * 없으면 내 정보의 친구 한도(entitlements), 그것도 없으면 카탈로그의 무료 한도다
 */
export function getFriendLimit(
  details: Record<string, unknown> | undefined,
  knownLimit: number | null,
) {
  const parsed = friendLimitErrorDetailsSchema.safeParse(details);
  if (parsed.success) {
    return parsed.data.limit;
  }

  return knownLimit ?? PREMIUM_FEATURES.FRIEND.free;
}

/** 친구 한도(FOLLOW_0909)에서 초대를 쓸 수 있으면 구독 대신 친구 초대로 자리를 늘리는 길을 먼저 보인다 */
export function getFriendLimitDialog(
  details: Record<string, unknown> | undefined,
  isInviteAvailable: boolean,
  knownLimit: number | null,
): FriendLimitDialog {
  return isInviteAvailable
    ? { type: 'invite', limit: getFriendLimit(details, knownLimit) }
    : { type: 'subscribe' };
}

export const FriendPolicy = {
  hasValidUserTag,
  hasValidSearchQuery,
  getRequestState,
  getFriendLimit,
  getFriendLimitDialog,
} as const;
