import type { NotificationType } from "../types/notification-type";

/**
 * 푸시 발송 자격 정책 (순수 도메인).
 *
 * 어떤 알림 타입이 마케팅 동의를 요구하는지, 야간(21:00-08:00)에도 예외적으로
 * 발송되는지를 소유한다. 실제 발송 오케스트레이션(설정/rate-limit/동의 조회)은
 * 애플리케이션 서비스가 이 정책을 사용해 수행한다.
 */

/** 마케팅 동의가 필요한 알림 타입 (현재 없음, 향후 MARKETING_* 추가 예정) */
export const MARKETING_NOTIFICATION_TYPES: ReadonlySet<NotificationType> =
	new Set<NotificationType>();

/**
 * 야간 시간(21:00-08:00)에도 푸시를 발송하는 알림 타입
 *
 * - WEATHER_MORNING: 사용자가 직접 선택한 아침 시간, 못 받으면 무의미
 * - WEATHER_EVENING: 사용자가 직접 선택한 저녁 시간
 * - STREAK_AT_RISK: 스트릭 위기는 즉시성이 중요 (서버 지연 시 21:00 넘김 대비)
 */
export const NIGHT_EXEMPT_NOTIFICATION_TYPES: ReadonlySet<NotificationType> =
	new Set<NotificationType>([
		"WEATHER_MORNING",
		"WEATHER_EVENING",
		"STREAK_AT_RISK",
	]);

/** 마케팅 동의가 필요한 알림 타입인지 */
export function isMarketingNotification(type: NotificationType): boolean {
	return MARKETING_NOTIFICATION_TYPES.has(type);
}

/** 야간 발송 예외 타입인지 */
export function isNightExemptNotification(type: NotificationType): boolean {
	return NIGHT_EXEMPT_NOTIFICATION_TYPES.has(type);
}
