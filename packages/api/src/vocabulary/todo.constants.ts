export const TODO_LIMITS = {
  TITLE_MAX_LENGTH: 200, // 할 일 제목 최대 길이
  MAX_PER_CATEGORY: 300, // 카테고리당 최대 활성 투두 (모든 구독 동일)
} as const;

export const RECURRING_TODO_LIMITS = {
  MAX_DAYS_RANGE: 366,
} as const;

/** 반복 할 일 시스템 상한. 성능·안정성 한도라 등급과 상관없이 ADMIN에도 같다. */
export const TODO_SERIES_LIMITS = {
  MAX_ACTIVE_PER_USER: 30,
  /** 1.14.x 이하 앱이 쓰는 반복 생성 경로의 상한. 그 앱의 서버에 없던 거절이라 넉넉하게 두고, 최소 지원 버전이 1.15.0이 되면 지운다. */
  MAX_ACTIVE_PER_USER_LEGACY: 300,
  MAX_COUNT: 365,
  VISIBLE_AHEAD_DAYS: 90,
} as const;

export const TODO_ITEM_LIMITS = {
  /** 투두당 최대 하위 항목 수 */
  MAX_PER_TODO: 20,
} as const;
