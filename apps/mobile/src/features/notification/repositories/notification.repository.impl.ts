import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import {
  type GetNotificationsQuery,
  type MarkReadResult,
  markReadResultSchema,
  type NotificationListResult,
  notificationListResponseSchema,
  type RegisterTokenResult,
  registerTokenResultSchema,
  type UnreadCountResult,
  unreadCountResultSchema,
} from '../models/notification.model';
import { toNotificationListResult } from './notification.mapper';
import type { NotificationRepository } from './notification.repository';

export class NotificationRepositoryImpl implements NotificationRepository {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async registerToken(
    token: string,
    deviceId: string,
  ): Promise<Result<RegisterTokenResult, ApiError>> {
    const result = await this.#httpClient.post<unknown>('v1/notifications/token', {
      token,
      deviceId,
    });

    if (!result.ok) return result;

    const parsed = registerTokenResultSchema.safeParse(result.value);
    if (!parsed.success) {
      // TODO: Sentry 연동 후 제거
      console.error('[NotificationRepository] Invalid registerToken response:', parsed.error);
      throw new ParseError();
    }

    return ok(parsed.data);
  }

  async unregisterToken(deviceId?: string): Promise<Result<void, ApiError>> {
    const result = await this.#httpClient.delete<unknown>('v1/notifications/token', {
      params: deviceId ? { deviceId } : undefined,
    });

    if (!result.ok) return result;

    return ok(undefined);
  }

  async getNotifications(
    query?: GetNotificationsQuery,
  ): Promise<Result<NotificationListResult, ApiError>> {
    const result = await this.#httpClient.get<unknown>('v1/notifications', {
      params: {
        limit: query?.limit,
        cursor: query?.cursor,
        category: query?.category,
        unreadOnly: query?.unreadOnly,
      },
    });

    if (!result.ok) return result;

    const parsed = notificationListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[NotificationRepository] Invalid getNotifications response:', parsed.error);
      throw new ParseError();
    }

    return ok(toNotificationListResult(parsed.data));
  }

  async getUnreadCount(): Promise<Result<UnreadCountResult, ApiError>> {
    const result = await this.#httpClient.get<unknown>('v1/notifications/unread-count');

    if (!result.ok) return result;

    const parsed = unreadCountResultSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[NotificationRepository] Invalid getUnreadCount response:', parsed.error);
      throw new ParseError();
    }

    return ok(parsed.data);
  }

  async markAsRead(notificationId: number): Promise<Result<MarkReadResult, ApiError>> {
    const result = await this.#httpClient.patch<unknown>(`v1/notifications/${notificationId}/read`);

    if (!result.ok) return result;

    const parsed = markReadResultSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[NotificationRepository] Invalid markAsRead response:', parsed.error);
      throw new ParseError();
    }

    return ok(parsed.data);
  }

  async markAllAsRead(): Promise<Result<MarkReadResult, ApiError>> {
    const result = await this.#httpClient.patch<unknown>('v1/notifications/read-all');

    if (!result.ok) return result;

    const parsed = markReadResultSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[NotificationRepository] Invalid markAllAsRead response:', parsed.error);
      throw new ParseError();
    }

    return ok(parsed.data);
  }
}
