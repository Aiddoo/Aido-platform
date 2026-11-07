import { PREMIUM_FEATURES, USER_SEARCH_QUERY_LENGTH } from '@aido/api/vocabulary';

import { type SearchedUser, userTagSchema } from '../schemas/friend.schema';

type RequestState = 'friend' | 'pending' | 'none';

type FriendLimitOffer = { type: 'invite'; limit: number } | { type: 'subscribe' };

interface FriendLimitOfferInput {
  isInviteAvailable: boolean;
  /** 친구 한도(FOLLOW_0909) 오류가 알려 준 인원 */
  serverLimit: number | null;
  /** 내 정보(entitlements)의 친구 한도 */
  knownLimit: number | null;
}

function hasValidUserTag(user: Pick<SearchedUser, 'userTag'>) {
  return userTagSchema.safeParse(user.userTag.trim()).success;
}

function hasValidSearchQuery(input: { query: string }) {
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
function getFriendLimit({
  serverLimit,
  knownLimit,
}: Pick<FriendLimitOfferInput, 'serverLimit' | 'knownLimit'>) {
  return serverLimit ?? knownLimit ?? PREMIUM_FEATURES.FRIEND.free;
}

/** 친구 한도에서 초대를 쓸 수 있으면 구독 대신 친구 초대로 자리를 늘리는 길을 먼저 권한다 */
function getFriendLimitOffer({
  isInviteAvailable,
  serverLimit,
  knownLimit,
}: FriendLimitOfferInput): FriendLimitOffer {
  return isInviteAvailable
    ? { type: 'invite', limit: getFriendLimit({ serverLimit, knownLimit }) }
    : { type: 'subscribe' };
}

export const FriendPolicy = {
  hasValidUserTag,
  hasValidSearchQuery,
  getRequestState,
  getFriendLimitOffer,
} as const;
