import { PREMIUM_FEATURES, USER_SEARCH_QUERY_LENGTH } from '@aido/api/vocabulary';

import { isUserTagFormat, type SearchedUser } from '../schemas/friend.schema';

type RequestState = 'friend' | 'pending' | 'none';

interface FriendLimitInput {
  /** 친구 한도(FOLLOW_0909) 오류가 알려 준 인원 */
  serverLimit: number | null;
  /** 내 정보(entitlements)의 친구 한도 */
  knownLimit: number | null;
}

function isValidUserTag(user: Pick<SearchedUser, 'userTag'>) {
  return isUserTagFormat(user.userTag.trim());
}

function isValidSearchQuery(input: { query: string }) {
  return input.query.trim().length >= USER_SEARCH_QUERY_LENGTH.MIN;
}

/** 검색 결과의 사용자와 나 사이 요청 상태. 이미 친구면 요청 대기보다 먼저다 */
function getRequestState(user: Pick<SearchedUser, 'isFriend' | 'requestPending'>): RequestState {
  if (user.isFriend) {
    return 'friend';
  }
  if (user.requestPending) {
    return 'pending';
  }

  return 'none';
}

/**
 * 친구 한도에 닿았을 때 안내할 인원. 초대로 늘어난 자리는 서버가 오류로 알려 준다.
 * 없으면 내 정보의 친구 한도, 그것도 없으면 카탈로그의 무료 한도다
 */
function getFriendLimit({ serverLimit, knownLimit }: FriendLimitInput) {
  return serverLimit ?? knownLimit ?? PREMIUM_FEATURES.FRIEND.free;
}

export const FriendPolicy = {
  isValidUserTag,
  isValidSearchQuery,
  getRequestState,
  getFriendLimit,
} as const;
