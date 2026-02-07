import {
  NOTIFICATION_CATEGORY,
  type NotificationCategory,
  type NotificationType,
} from '@src/features/notification/models/notification.model';

export const CATEGORY = NOTIFICATION_CATEGORY;

export const CATEGORY_TABS: readonly { value: NotificationCategory; label: string }[] = [
  { value: CATEGORY.ALL, label: '전체' },
  { value: CATEGORY.NOTICE, label: '공지' },
  { value: CATEGORY.TODO, label: '할일' },
  { value: CATEGORY.SOCIAL, label: '소셜' },
] as const;

export const NOTIFICATION_CATEGORY_LABEL: Record<NotificationType, string> = {
  FOLLOW_NEW: '친구',
  FOLLOW_ACCEPTED: '친구',
  NUDGE_RECEIVED: '콕 찌르기',
  CHEER_RECEIVED: '응원',
  DAILY_COMPLETE: '달성',
  FRIEND_COMPLETED: '달성',
  TODO_REMINDER: '할일',
  TODO_SHARED: '할일',
  MORNING_REMINDER: '리마인더',
  EVENING_REMINDER: '리마인더',
  WEEKLY_ACHIEVEMENT: '달성',
  SYSTEM_NOTICE: '공지',
  ADMIN_BROADCAST: '공지',
  ADMIN_TARGETED: '공지',
};
