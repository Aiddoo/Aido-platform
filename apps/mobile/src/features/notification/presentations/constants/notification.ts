import {
  NOTIFICATION_CATEGORY,
  type NotificationCategory,
} from '@src/features/notification/models/notification.model';

export const CATEGORY_TABS: readonly { value: NotificationCategory; label: string }[] = [
  { value: NOTIFICATION_CATEGORY.ALL, label: '전체' },
  { value: NOTIFICATION_CATEGORY.NOTICE, label: '공지' },
  { value: NOTIFICATION_CATEGORY.TODO, label: '할일' },
  { value: NOTIFICATION_CATEGORY.SOCIAL, label: '소셜' },
] as const;
