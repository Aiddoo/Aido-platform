import type {
  GetNotificationsQuery,
  MarkReadResult,
  NotificationListResponse,
  RegisterTokenResult,
  UnreadCountResult,
} from '../models/notification.model';

/**
 * Repository interface for notification API operations
 */
export interface NotificationRepository {
  // Push Token
  registerToken: (token: string, deviceId: string) => Promise<RegisterTokenResult>;
  unregisterToken: (deviceId?: string) => Promise<void>;

  // Notifications
  getNotifications: (query?: GetNotificationsQuery) => Promise<NotificationListResponse>;
  getUnreadCount: () => Promise<UnreadCountResult>;
  markAsRead: (notificationId: number) => Promise<MarkReadResult>;
  markAllAsRead: () => Promise<MarkReadResult>;
}
