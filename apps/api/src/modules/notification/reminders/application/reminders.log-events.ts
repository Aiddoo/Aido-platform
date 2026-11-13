export const NotificationRemindersLogEvent = {
  TIMEZONE_AWARE_REMINDER_SWEEP_STARTED:
    "notification.reminders.timezone-aware-reminder.sweep-started",
  TIMEZONE_AWARE_REMINDER_TIMEZONE_FAILED:
    "notification.reminders.timezone-aware-reminder.timezone-failed",
  TIMEZONE_AWARE_REMINDER_SWEEP_COMPLETED:
    "notification.reminders.timezone-aware-reminder.sweep-completed",
  TIMEZONE_AWARE_REMINDER_MINUTES_SKIPPED:
    "notification.reminders.timezone-aware-reminder.minutes-skipped",
  TIMEZONE_AWARE_REMINDER_SWEEP_FAILED:
    "notification.reminders.timezone-aware-reminder.sweep-failed",
  TIMEZONE_AWARE_REMINDER_CATCH_UP_MORNING:
    "notification.reminders.timezone-aware-reminder.catch-up-morning",
  TIMEZONE_AWARE_REMINDER_CATCH_UP_EVENING:
    "notification.reminders.timezone-aware-reminder.catch-up-evening",
  TIMEZONE_AWARE_REMINDER_CATCH_UP_FAILED:
    "notification.reminders.timezone-aware-reminder.catch-up-failed",
  TIMEZONE_AWARE_REMINDER_LEGACY_DIGEST_SKIPPED:
    "notification.reminders.timezone-aware-reminder.legacy-digest-skipped",
  TIMEZONE_AWARE_REMINDER_DIGEST_FAILED:
    "notification.reminders.timezone-aware-reminder.digest-failed",
  EVENING_REMINDER_SENT: "notification.reminders.evening-reminder.sent",
  LUNCH_NUDGE_SENT: "notification.reminders.lunch-nudge.sent",
  MONTHLY_REPORT_SENT: "notification.reminders.monthly-report.sent",
  MORNING_REMINDER_SENT: "notification.reminders.morning-reminder.sent",
  NUDGE_SUGGEST_SENT: "notification.reminders.nudge-suggest.sent",
  ONBOARDING_SENT: "notification.reminders.onboarding.sent",
  SOCIAL_DIGEST_SENT: "notification.reminders.social-digest.sent",
  STREAK_AT_RISK_SENT: "notification.reminders.streak-at-risk.sent",
  WEATHER_EVENING_SENT: "notification.reminders.weather-evening.sent",
  WEATHER_MORNING_SENT: "notification.reminders.weather-morning.sent",
  WEEKLY_ACHIEVEMENT_SENT: "notification.reminders.weekly-achievement.sent",
  WEEKLY_REPORT_SENT: "notification.reminders.weekly-report.sent",
  TODO_REMINDER_LATE_SKIPPED: "notification.reminders.todo-reminder.late-skipped",
  TODO_REMINDER_BATCH_PUBLISHED: "notification.reminders.todo-reminder.batch-published",
  TODO_REMINDER_BATCH_PUBLISH_FAILED: "notification.reminders.todo-reminder.batch-publish-failed",
  WINBACK_SENT: "notification.reminders.winback.sent",
} as const;
