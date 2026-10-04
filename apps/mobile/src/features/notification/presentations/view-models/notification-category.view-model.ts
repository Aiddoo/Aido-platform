import type { NotificationType } from '@aido/validators';
import { match } from 'ts-pattern';
import { z } from 'zod';

const notificationCategoryKeySchema = z.enum([
  'friend',
  'nudge',
  'cheer',
  'achievement',
  'todo',
  'reminder',
  'ai',
  'notice',
  'social',
]);
export type NotificationCategoryKey = z.infer<typeof notificationCategoryKeySchema>;

export const getCategoryKey = (type: NotificationType): NotificationCategoryKey =>
  match<NotificationType, NotificationCategoryKey>(type)
    .with('FOLLOW_NEW', 'FOLLOW_ACCEPTED', () => 'friend')
    .with('NUDGE_RECEIVED', 'NUDGE_REPLIED', 'NUDGE_THANKED', () => 'nudge')
    .with('CHEER_RECEIVED', () => 'cheer')
    .with('DAILY_COMPLETE', 'FRIEND_COMPLETED', 'WEEKLY_ACHIEVEMENT', () => 'achievement')
    .with(
      'TODO_REMINDER',
      'TODO_SHARED',
      'WINBACK',
      'WEATHER_MORNING',
      'WEATHER_EVENING',
      () => 'todo',
    )
    .with('MORNING_REMINDER', 'EVENING_REMINDER', 'LUNCH_NUDGE', 'STREAK_AT_RISK', () => 'reminder')
    .with('WEEKLY_REPORT', 'MONTHLY_REPORT', 'AI_SUGGESTION', () => 'ai')
    .with('SYSTEM_NOTICE', 'ADMIN_BROADCAST', 'ADMIN_TARGETED', () => 'notice')
    .with('SOCIAL_DIGEST', 'NUDGE_SUGGEST', () => 'social')
    .exhaustive();
