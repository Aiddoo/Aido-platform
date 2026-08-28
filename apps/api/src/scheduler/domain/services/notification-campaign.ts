/**
 * 반복 푸시의 분석/카피 버전 키.
 * 카피 풀 또는 대상 정책이 바뀌면 해당 키의 버전을 올린다.
 */
export const SCHEDULER_CAMPAIGN_KEY = {
	TODO_REMINDER: "todo_reminder_v3",
	MORNING_REMINDER: "morning_reminder_v3",
	EVENING_REMINDER: "evening_reminder_v3",
	WEEKLY_ACHIEVEMENT: "weekly_achievement_v3",
	WEEKLY_REPORT: "weekly_report_v3",
	MONTHLY_REPORT: "monthly_report_v3",
	ONBOARDING: "onboarding_v3",
	LUNCH_NUDGE: "lunch_nudge_v3",
	NUDGE_SUGGEST: "nudge_suggest_v3",
	WINBACK: "winback_v3",
	STREAK_AT_RISK: "streak_at_risk_v3",
	SOCIAL_DIGEST: "social_digest_v3",
	WEATHER_MORNING: "weather_morning_v3",
	WEATHER_EVENING: "weather_evening_v3",
} as const;

/** 저녁 리마인더와 소셜 다이제스트 사이의 피로도 완충 시간. */
export const SOCIAL_DIGEST_DELAY_MS = 90 * 60 * 1000;
