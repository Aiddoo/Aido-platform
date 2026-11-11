/**
 * 반복 푸시의 분석/카피 버전 키.
 * 카피 풀 또는 대상 정책이 바뀌면 해당 키의 버전을 올린다.
 */
export const SCHEDULER_CAMPAIGN_KEY = {
  TODO_REMINDER: "todo_reminder_v4",
  TODO_SERIES_PAUSED: "todo_series_paused_v1",
  MORNING_REMINDER: "morning_reminder_v4",
  EVENING_REMINDER: "evening_reminder_v4",
  WEEKLY_ACHIEVEMENT: "weekly_achievement_v4",
  WEEKLY_REPORT: "weekly_report_v4",
  MONTHLY_REPORT: "monthly_report_v4",
  ONBOARDING: "onboarding_v4",
  LUNCH_NUDGE: "lunch_nudge_v4",
  NUDGE_SUGGEST: "nudge_suggest_v4",
  WINBACK: "winback_v4",
  STREAK_AT_RISK: "streak_at_risk_v4",
  SOCIAL_DIGEST: "social_digest_v4",
  WEATHER_MORNING: "weather_morning_v4",
  WEATHER_EVENING: "weather_evening_v4",
  // 1.15.0에 거래 알림으로 바꾸고 광고 문구를 빼 버전을 올렸다
  PREMIUM_GRANT_ENDING: "premium_grant_ending_v2",
  PREMIUM_TRIAL_ENDING: "premium_trial_ending_v1",
  PREMIUM_RENEWAL_UPCOMING: "premium_renewal_upcoming_v1",
  MARKETING_CONSENT_RECONFIRM: "marketing_consent_reconfirm_v1",
} as const;

/** 저녁 리마인더와 소셜 다이제스트 사이의 피로도 완충 시간. */
export const SOCIAL_DIGEST_DELAY_MS = 90 * 60 * 1000;
