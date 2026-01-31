import type { HttpClient } from '@src/core/ports/http';

import { NotificationValidationError } from '../models/notification.error';
import {
  type GetNotificationsQuery,
  type MarkReadResult,
  markReadResultSchema,
  type NotificationListResponse,
  notificationListResponseSchema,
  type RegisterTokenResult,
  registerTokenResultSchema,
  type UnreadCountResult,
  unreadCountResultSchema,
} from '../models/notification.model';
import type { NotificationRepository } from './notification.repository';

export class NotificationRepositoryImpl implements NotificationRepository {
  constructor(private readonly _httpClient: HttpClient) {}

  async registerToken(token: string, deviceId: string): Promise<RegisterTokenResult> {
    const { data } = await this._httpClient.post<unknown>('v1/notifications/token', {
      token,
      deviceId,
    });

    const result = registerTokenResultSchema.safeParse(data);
    if (!result.success) {
      console.error('[NotificationRepository] Invalid registerToken response:', result.error);
      throw new NotificationValidationError();
    }
    return result.data;
  }

  async unregisterToken(deviceId?: string): Promise<void> {
    const params = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
    await this._httpClient.delete(`v1/notifications/token${params}`);
  }

  async getNotifications(query?: GetNotificationsQuery): Promise<NotificationListResponse> {
    const params = new URLSearchParams();
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', String(query.cursor));
    if (query?.unreadOnly) params.set('unreadOnly', 'true');

    const queryString = params.toString();
    const url = `v1/notifications${queryString ? `?${queryString}` : ''}`;

    const { data } = await this._httpClient.get<unknown>(url);

    const result = notificationListResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('[NotificationRepository] Invalid getNotifications response:', result.error);
      throw new NotificationValidationError();
    }
    return result.data;
  }

  async getUnreadCount(): Promise<UnreadCountResult> {
    const { data } = await this._httpClient.get<unknown>('v1/notifications/unread-count');

    const result = unreadCountResultSchema.safeParse(data);
    if (!result.success) {
      console.error('[NotificationRepository] Invalid getUnreadCount response:', result.error);
      throw new NotificationValidationError();
    }
    return result.data;
  }

  async markAsRead(notificationId: number): Promise<MarkReadResult> {
    const { data } = await this._httpClient.patch<unknown>(
      `v1/notifications/${notificationId}/read`,
    );

    const result = markReadResultSchema.safeParse(data);
    if (!result.success) {
      console.error('[NotificationRepository] Invalid markAsRead response:', result.error);
      throw new NotificationValidationError();
    }
    return result.data;
  }

  async markAllAsRead(): Promise<MarkReadResult> {
    const { data } = await this._httpClient.patch<unknown>('v1/notifications/read-all');

    const result = markReadResultSchema.safeParse(data);
    if (!result.success) {
      console.error('[NotificationRepository] Invalid markAllAsRead response:', result.error);
      throw new NotificationValidationError();
    }
    return result.data;
  }
}
