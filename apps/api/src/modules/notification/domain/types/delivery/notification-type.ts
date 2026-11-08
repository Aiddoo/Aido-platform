/**
 * 알림 타입 도메인 유니온.
 *
 * DB `NotificationType` enum과 구조적으로 동일한 문자열 유니온이다.
 * 도메인/애플리케이션 레이어가 `@/generated` 결합 없이 알림 타입을 다루도록
 * (경계 규칙: domain·application → ORM 임포트 금지) 소유한다.
 */
export type NotificationType =
  | "FOLLOW_NEW"
  | "FOLLOW_ACCEPTED"
  | "NUDGE_RECEIVED"
  | "NUDGE_REPLIED"
  | "NUDGE_THANKED"
  | "CHEER_RECEIVED"
  | "DAILY_COMPLETE"
  | "FRIEND_COMPLETED"
  | "TODO_REMINDER"
  | "TODO_SHARED"
  | "MORNING_REMINDER"
  | "EVENING_REMINDER"
  | "WEEKLY_ACHIEVEMENT"
  | "WEEKLY_REPORT"
  | "MONTHLY_REPORT"
  | "AI_SUGGESTION"
  | "SYSTEM_NOTICE"
  | "ADMIN_BROADCAST"
  | "ADMIN_TARGETED"
  | "WINBACK"
  | "SOCIAL_DIGEST"
  | "NUDGE_SUGGEST"
  | "LUNCH_NUDGE"
  | "STREAK_AT_RISK"
  | "WEATHER_MORNING"
  | "WEATHER_EVENING"
  | "INVITE_JOINED"
  | "INVITE_REWARDED"
  | "INVITE_PROGRESS"
  | "INVITE_QUALIFY_REMINDER"
  | "PREMIUM_GRANT_ENDING"
  /** 서버 전용. 앱 계약 enum에 없어 푸시·알림함에는 SYSTEM_NOTICE로 보낸다(toWireNotificationType). */
  | "PREMIUM_TRIAL_ENDING";
