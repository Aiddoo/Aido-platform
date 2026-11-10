import type { NotificationType } from "../../inbox/domain/notification-type.constants.js";

/**
 * 푸시 발송 자격 정책 (순수 도메인).
 *
 * 어떤 알림 타입이 마케팅 동의를 요구하는지, 야간(21:00-08:00)에도 예외적으로
 * 발송되는지를 소유한다. 실제 발송 오케스트레이션(설정/rate-limit/동의 조회)은
 * 애플리케이션 서비스가 이 정책을 사용해 수행한다.
 */

/**
 * 서비스 이용을 직접 수행한 결과가 아닌 재방문/참여 유도 알림.
 * 보상·체험 종료와 연간 갱신 안내(PREMIUM_GRANT_ENDING·PREMIUM_TRIAL_ENDING·PREMIUM_RENEWAL_UPCOMING)는
 * 이용 중인 혜택의 거래 정보라 넣지 않는다.
 */
const MARKETING_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "AI_SUGGESTION",
  "WINBACK",
  "SOCIAL_DIGEST",
  "NUDGE_SUGGEST",
  "LUNCH_NUDGE",
  "STREAK_AT_RISK",
  // 초대받은 사람이 직접 한 행동의 결과가 아니라 사용 시작을 권하는 자동 알림이다
  "INVITE_QUALIFY_REMINDER",
]);

const AUTOMATED_ENGAGEMENT_NOTIFICATION_TYPES = MARKETING_NOTIFICATION_TYPES;

/**
 * 사용자가 직접 정한 시각에 울려 야간 수신을 꺼도 보내는 알림 타입. 광고성 야간 금지는 이 목록보다 먼저 적용된다
 *
 * - TODO_REMINDER: 사용자가 정한 할 일 시각의 60·10분 전. 그 자리에 대신 보내는 반복 멈춤 안내도 같은 시각이다
 * - MORNING_REMINDER·EVENING_REMINDER: 프리미엄이 고른 시각. 무료 기본 08:00·19:00은 야간 밖이다
 * - WEATHER_MORNING·WEATHER_EVENING: 사용자가 고른 날씨 알림 시각
 */
const NIGHT_EXEMPT_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "TODO_REMINDER",
  "MORNING_REMINDER",
  "EVENING_REMINDER",
  "WEATHER_MORNING",
  "WEATHER_EVENING",
]);

/** 마케팅 동의가 필요한 알림 타입인지 */
export function isMarketingNotification(type: NotificationType): boolean {
  return MARKETING_NOTIFICATION_TYPES.has(type);
}

export function isAutomatedEngagementNotification(type: NotificationType): boolean {
  return AUTOMATED_ENGAGEMENT_NOTIFICATION_TYPES.has(type);
}

/** 야간 발송 예외 타입인지 */
export function isNightExemptNotification(type: NotificationType): boolean {
  return NIGHT_EXEMPT_NOTIFICATION_TYPES.has(type);
}
