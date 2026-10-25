import type { NotificationType as ContractNotificationType } from "@aido/api/vocabulary";

/**
 * 알림 타입 도메인 유니온.
 *
 * Prisma `NotificationType` enum과 구조적으로 동일한 문자열 유니온이다.
 * 도메인/애플리케이션 레이어가 `@/generated` 결합 없이 알림 타입을 다루도록
 * (경계 규칙: domain·application → generated Prisma 임포트 금지) 소유한다.
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
  | "WEATHER_EVENING";

/** 공유 계약에는 있지만 Prisma `NotificationType` enum에는 아직 없는 알림 타입. */
export const UNPERSISTED_NOTIFICATION_TYPES = [
  "INVITE_JOINED",
  "INVITE_REWARDED",
  "PREMIUM_GRANT_ENDING",
] as const satisfies readonly ContractNotificationType[];

const UNPERSISTED_NOTIFICATION_TYPE_SET: ReadonlySet<ContractNotificationType> = new Set(
  UNPERSISTED_NOTIFICATION_TYPES,
);

// 초대 스키마 PR에서 Prisma enum에 값이 추가되기 전까지 저장소 조회 조건에서 뺀다
export function isPersistedNotificationType(
  type: ContractNotificationType,
): type is NotificationType {
  return !UNPERSISTED_NOTIFICATION_TYPE_SET.has(type);
}
