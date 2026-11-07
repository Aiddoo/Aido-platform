import type { NotificationType } from '../schemas/notification.schema';

/** 알림함 항목이 어느 분류의 라벨(`categories.*`)로 보이는지 */
export const NOTIFICATION_TYPE_LABEL_KEYS = {
  FOLLOW_NEW: 'friend',
  FOLLOW_ACCEPTED: 'friend',
  INVITE_JOINED: 'friend',
  INVITE_REWARDED: 'friend',
  INVITE_PROGRESS: 'friend',
  INVITE_QUALIFY_REMINDER: 'friend',
  NUDGE_RECEIVED: 'nudge',
  NUDGE_REPLIED: 'nudge',
  NUDGE_THANKED: 'nudge',
  CHEER_RECEIVED: 'cheer',
  DAILY_COMPLETE: 'achievement',
  FRIEND_COMPLETED: 'achievement',
  WEEKLY_ACHIEVEMENT: 'achievement',
  TODO_REMINDER: 'todo',
  TODO_SHARED: 'todo',
  WINBACK: 'todo',
  WEATHER_MORNING: 'todo',
  WEATHER_EVENING: 'todo',
  MORNING_REMINDER: 'reminder',
  EVENING_REMINDER: 'reminder',
  LUNCH_NUDGE: 'reminder',
  STREAK_AT_RISK: 'reminder',
  WEEKLY_REPORT: 'ai',
  MONTHLY_REPORT: 'ai',
  AI_SUGGESTION: 'ai',
  SYSTEM_NOTICE: 'notice',
  ADMIN_BROADCAST: 'notice',
  ADMIN_TARGETED: 'notice',
  PREMIUM_GRANT_ENDING: 'notice',
  SOCIAL_DIGEST: 'social',
  NUDGE_SUGGEST: 'social',
} as const satisfies Record<
  NotificationType,
  'friend' | 'nudge' | 'cheer' | 'achievement' | 'todo' | 'reminder' | 'ai' | 'notice' | 'social'
>;
