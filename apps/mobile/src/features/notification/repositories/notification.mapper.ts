import type {
  Notification,
  NotificationListResponse,
  NotificationListResult,
  ServerNotification,
} from '../models/notification.model';

export const toNotification = (server: ServerNotification): Notification => ({
  id: server.id,
  userId: server.userId,
  type: server.type,
  title: server.title,
  body: server.body,
  isRead: server.isRead,
  metadata: server.metadata,
  context: server.context,
  createdAt: new Date(server.createdAt),
  readAt: server.readAt ? new Date(server.readAt) : null,
});

export const toNotificationListResult = (
  server: NotificationListResponse,
): NotificationListResult => ({
  notifications: server.notifications.map(toNotification),
  unreadCount: server.unreadCount,
  hasMore: server.hasMore,
  nextCursor: server.nextCursor,
});
