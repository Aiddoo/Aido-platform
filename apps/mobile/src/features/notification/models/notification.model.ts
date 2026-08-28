import {
  type NotificationCategory,
  type NotificationListResponse,
  type Notification as NotificationDTO,
  type NotificationRouting,
  type NotificationType,
} from '@aido/validators';

import { getCategoryKey } from './notification-category.model';

export type Notification = Omit<NotificationDTO, 'createdAt' | 'metadata' | 'readAt'> & {
  createdAt: Date;
  readAt: Date | null;
  routing?: NotificationRouting;
};

export type NotificationListResult = Omit<NotificationListResponse, 'notifications'> & {
  notifications: Notification[];
};

export interface GetNotificationsQuery {
  limit?: number;
  cursor?: number;
  category?: NotificationCategory;
  unreadOnly?: boolean;
}

const AI_FEATURE_TYPES: ReadonlySet<NotificationType> = new Set([
  'WEEKLY_REPORT',
  'MONTHLY_REPORT',
  'AI_SUGGESTION',
]);

export const NotificationPolicy = {
  categoryKey(notification: Notification) {
    return getCategoryKey(notification.type);
  },

  isAiFeature(notification: Notification) {
    return AI_FEATURE_TYPES.has(notification.type);
  },
};
