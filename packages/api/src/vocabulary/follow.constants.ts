/** 사용자 검색어 길이(앞뒤 공백 제외). 요청 검증과 앱의 검색 시작 조건이 같은 값을 쓴다. */
export const USER_SEARCH_QUERY_LENGTH = {
  MIN: 2,
  MAX: 50,
} as const;

/** 사용자 태그(Aido ID)의 길이. 서버가 발급하고 앱의 친구 검색 입력이 같은 길이를 요구한다. */
export const USER_TAG_LENGTH = 8;

export const FOLLOW_STATUSES = ["PENDING", "ACCEPTED"] as const;
