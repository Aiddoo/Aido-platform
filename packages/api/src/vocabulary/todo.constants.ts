export const TODO_LIMITS = {
  MAX_PER_CATEGORY: 300, // 카테고리당 최대 활성 투두 (모든 구독 동일)
} as const;

export const RECURRING_TODO_LIMITS = {
  MAX_INSTANCES: 100,
  MAX_DAYS_RANGE: 366,
} as const;

/** 반복 할 일 시스템 상한. 성능·안정성 한도라 등급과 상관없이 ADMIN에도 같다. */
export const TODO_SERIES_LIMITS = {
  MAX_ACTIVE_PER_USER: 30,
  MAX_COUNT: 365,
  VISIBLE_AHEAD_DAYS: 90,
} as const;

export const TODO_ITEM_LIMITS = {
  /** 투두당 최대 하위 항목 수 */
  MAX_PER_TODO: 20,
} as const;
