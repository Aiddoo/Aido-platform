import type {
  Notification,
  NotificationListResponse,
  NotificationListResult,
  ServerNotification,
} from '../models/notification.model';

export const NotificationMapper = {
  toNotification: (server: ServerNotification): Notification => ({
    id: server.id,
    userId: server.userId,
    type: server.type as Notification['type'],
    title: server.title,
    body: server.body,
    isRead: server.isRead,
    route: server.route,
    metadata: server.metadata,
    createdAt: new Date(server.createdAt),
    readAt: server.readAt ? new Date(server.readAt) : null,
  }),

  toNotificationListResult: (server: NotificationListResponse): NotificationListResult => ({
    notifications: server.notifications.map(NotificationMapper.toNotification),
    unreadCount: server.unreadCount,
    hasMore: server.hasMore,
    nextCursor: server.nextCursor,
  }),
} as const;
