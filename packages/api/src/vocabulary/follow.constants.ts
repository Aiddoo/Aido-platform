export const FOLLOW_LIMITS = {
  FREE_MAX_FRIENDS: 5,
} as const;

/** 사용자 검색어 길이(앞뒤 공백 제외). 요청 검증과 앱의 검색 시작 조건이 같은 값을 쓴다. */
export const USER_SEARCH_QUERY_LENGTH = {
  MIN: 2,
  MAX: 50,
} as const;

export const SUBSCRIPTION_FOLLOW_LIMITS = {
  FREE: FOLLOW_LIMITS.FREE_MAX_FRIENDS,
  ACTIVE: null, // 무제한
  EXPIRED: FOLLOW_LIMITS.FREE_MAX_FRIENDS,
  CANCELLED: FOLLOW_LIMITS.FREE_MAX_FRIENDS,
} as const;
