import type { NotificationType } from "../types/notification-type";

/**
 * 푸시 발송 자격 정책 (순수 도메인).
 *
 * 어떤 알림 타입이 마케팅 동의를 요구하는지, 야간(21:00-08:00)에도 예외적으로
 * 발송되는지를 소유한다. 실제 발송 오케스트레이션(설정/rate-limit/동의 조회)은
 * 애플리케이션 서비스가 이 정책을 사용해 수행한다.
 */

/** 서비스 이용을 직접 수행한 결과가 아닌 재방문/참여 유도 알림 */
export const MARKETING_NOTIFICATION_TYPES: ReadonlySet<NotificationType> =
	new Set<NotificationType>([
		"AI_SUGGESTION",
		"WINBACK",
		"SOCIAL_DIGEST",
		"NUDGE_SUGGEST",
		"LUNCH_NUDGE",
		"STREAK_AT_RISK",
	]);

export const AUTOMATED_ENGAGEMENT_NOTIFICATION_TYPES =
	MARKETING_NOTIFICATION_TYPES;

/**
 * 야간 시간(21:00-08:00)에도 푸시를 발송하는 알림 타입
 *
 * - WEATHER_MORNING: 사용자가 직접 선택한 아침 시간, 못 받으면 무의미
 * - WEATHER_EVENING: 사용자가 직접 선택한 저녁 시간
 */
export const NIGHT_EXEMPT_NOTIFICATION_TYPES: ReadonlySet<NotificationType> =
	new Set<NotificationType>(["WEATHER_MORNING", "WEATHER_EVENING"]);

/** 마케팅 동의가 필요한 알림 타입인지 */
export function isMarketingNotification(type: NotificationType): boolean {
	return MARKETING_NOTIFICATION_TYPES.has(type);
}

export function isAutomatedEngagementNotification(
	type: NotificationType,
): boolean {
	return AUTOMATED_ENGAGEMENT_NOTIFICATION_TYPES.has(type);
}

/** 야간 발송 예외 타입인지 */
export function isNightExemptNotification(type: NotificationType): boolean {
	return NIGHT_EXEMPT_NOTIFICATION_TYPES.has(type);
}
