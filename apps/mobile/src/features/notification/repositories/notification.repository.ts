import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';

import type {
  GetNotificationsQuery,
  MarkReadResult,
  NotificationListResult,
  RegisterTokenResult,
  UnreadCountResult,
} from '../models/notification.model';

export interface NotificationRepository {
  // Push Token
  registerToken(token: string, deviceId: string): Promise<Result<RegisterTokenResult, ApiError>>;
  unregisterToken(deviceId?: string): Promise<Result<void, ApiError>>;

  // Notifications
  getNotifications(
    query?: GetNotificationsQuery,
  ): Promise<Result<NotificationListResult, ApiError>>;
  getUnreadCount(): Promise<Result<UnreadCountResult, ApiError>>;
  markAsRead(notificationId: number): Promise<Result<MarkReadResult, ApiError>>;
  markAllAsRead(): Promise<Result<MarkReadResult, ApiError>>;
}
