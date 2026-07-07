import { NOTIFICATION_CATEGORY, type NotificationCategory } from '@aido/validators';

export const CATEGORY_TABS = [
  { value: NOTIFICATION_CATEGORY.ALL, labelKey: 'categories.all' },
  { value: NOTIFICATION_CATEGORY.NOTICE, labelKey: 'categories.notice' },
  { value: NOTIFICATION_CATEGORY.TODO, labelKey: 'categories.todo' },
  { value: NOTIFICATION_CATEGORY.SOCIAL, labelKey: 'categories.social' },
] as const satisfies readonly { value: NotificationCategory; labelKey: string }[];
