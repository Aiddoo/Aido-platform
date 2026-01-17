/**
 * Nudge Constants
 *
 * 독촉 관련 상수
 */

/** 독촉 제한 규칙 */
export const NUDGE_LIMITS = {
  /** FREE 사용자 일일 독촉 제한 */
  FREE_DAILY_LIMIT: 3,

  /** 같은 Todo 재독촉 쿨다운 (시간) */
  COOLDOWN_HOURS: 24,

  /** 독촉 메시지 최대 길이 */
  MAX_MESSAGE_LENGTH: 200,
} as const;

/** 구독 상태에 따른 독촉 제한 */
export const SUBSCRIPTION_NUDGE_LIMITS = {
  FREE: NUDGE_LIMITS.FREE_DAILY_LIMIT,
  ACTIVE: null, // 무제한
  EXPIRED: NUDGE_LIMITS.FREE_DAILY_LIMIT,
  CANCELLED: NUDGE_LIMITS.FREE_DAILY_LIMIT,
} as const;
