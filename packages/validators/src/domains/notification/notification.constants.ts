/**
 * Notification Constants
 *
 * 알림 관련 상수
 */

/** 알림 타입 */
export const NOTIFICATION_TYPE = {
  /** 새 팔로우 요청 */
  FOLLOW_NEW: 'FOLLOW_NEW',
  /** 맞팔로우 성립 */
  FOLLOW_ACCEPTED: 'FOLLOW_ACCEPTED',
  /** 콕 찌름 수신 */
  NUDGE_RECEIVED: 'NUDGE_RECEIVED',
  /** 응원 수신 */
  CHEER_RECEIVED: 'CHEER_RECEIVED',
  /** 일일 완료 */
  DAILY_COMPLETE: 'DAILY_COMPLETE',
  /** 친구 할일 완료 */
  FRIEND_COMPLETED: 'FRIEND_COMPLETED',
  /** 할일 리마인더 */
  TODO_REMINDER: 'TODO_REMINDER',
  /** 할일 공유 */
  TODO_SHARED: 'TODO_SHARED',
  /** 아침 리마인더 */
  MORNING_REMINDER: 'MORNING_REMINDER',
  /** 저녁 리마인더 */
  EVENING_REMINDER: 'EVENING_REMINDER',
  /** 주간 성취 */
  WEEKLY_ACHIEVEMENT: 'WEEKLY_ACHIEVEMENT',
  /** 시스템 공지 */
  SYSTEM_NOTICE: 'SYSTEM_NOTICE',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

/** 알림 관련 제한 */
export const NOTIFICATION_LIMITS = {
  /** 한 번에 조회 가능한 최대 알림 수 */
  MAX_FETCH_LIMIT: 50,

  /** 기본 조회 개수 */
  DEFAULT_FETCH_LIMIT: 20,

  /** 푸시 토큰 최대 길이 */
  MAX_PUSH_TOKEN_LENGTH: 200,
} as const;

/** Expo 푸시 토큰 형식 정규식 */
export const EXPO_PUSH_TOKEN_REGEX = /^ExponentPushToken\[.+\]$/;
