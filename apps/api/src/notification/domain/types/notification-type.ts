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
