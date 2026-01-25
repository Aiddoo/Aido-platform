/**
 * User Preference Constants
 *
 * 사용자 푸시 알림 설정 관련 상수
 */

/** 푸시 설정 기본값 */
export const USER_PREFERENCE_DEFAULTS = {
  /** 푸시 알림 기본값 (OFF) */
  PUSH_ENABLED: false,

  /** 야간 푸시 기본값 (OFF) */
  NIGHT_PUSH_ENABLED: false,
} as const;

/** 야간 시간대 설정 (KST 기준) */
export const NIGHT_TIME_CONFIG = {
  /** 야간 시작 시간 (21:00 KST) */
  START_HOUR: 21,

  /** 야간 종료 시간 (08:00 KST) */
  END_HOUR: 8,

  /** 타임존 오프셋 (UTC+9) */
  KST_OFFSET_HOURS: 9,
} as const;
