/**
 * Cheer Constants
 *
 * 응원 관련 상수
 */

/** 응원 제한 규칙 */
export const CHEER_LIMITS = {
  /** FREE 사용자 일일 응원 제한 */
  FREE_DAILY_LIMIT: 3,

  /** 같은 사용자 재응원 쿨다운 (시간) */
  COOLDOWN_HOURS: 24,

  /** 응원 메시지 최대 길이 */
  MAX_MESSAGE_LENGTH: 200,
} as const;

/** 구독 상태에 따른 응원 제한 */
export const SUBSCRIPTION_CHEER_LIMITS = {
  FREE: CHEER_LIMITS.FREE_DAILY_LIMIT,
  ACTIVE: null, // 무제한
  EXPIRED: CHEER_LIMITS.FREE_DAILY_LIMIT,
  CANCELLED: CHEER_LIMITS.FREE_DAILY_LIMIT,
} as const;
