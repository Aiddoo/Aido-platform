import {
  type MarkReadResponse,
  marketingPushOptOutResponseSchema,
  markReadResponseSchema,
  notificationInboxResponseSchema,
  notificationOpenedResponseSchema,
  unreadCountResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { PushNotificationGateway } from '@src/core/ports/push-notification-gateway';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { GetNotificationsQuery, NotificationListResult } from '../domains/notification.model';
import { toNotificationListResult } from './notification.mapper';

export class NotificationService {
  readonly #httpClient: HttpClient;
  readonly #badgeGateway: Pick<PushNotificationGateway, 'setBadgeCount'>;
  readonly #publicHttpClient: HttpClient;

  constructor(
    httpClient: HttpClient,
    badgeGateway: Pick<PushNotificationGateway, 'setBadgeCount'>,
    publicHttpClient: HttpClient = httpClient,
  ) {
    this.#httpClient = httpClient;
    this.#badgeGateway = badgeGateway;
    this.#publicHttpClient = publicHttpClient;
  }

  getNotifications = async (
    query?: GetNotificationsQuery,
    signal?: AbortSignal,
  ): Promise<Result<NotificationListResult, ApiError>> => {
    const result = await this.#httpClient.get('v1/notifications/inbox', {
      signal,
      params: {
        limit: query?.limit,
        cursor: query?.cursor,
        category: query?.category,
        unreadOnly: query?.unreadOnly,
      },
    });

    if (!result.ok) {
      return result;
    }

    const parsed = notificationInboxResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[NotificationService] Invalid getNotifications response: ${parsed.error.message}`,
      );
    }

    return ok(toNotificationListResult(parsed.data));
  };

  getUnreadCount = async (signal?: AbortSignal): Promise<Result<number, ApiError>> => {
    const result = await this.#httpClient.get('v1/notifications/inbox/unread-count', { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = unreadCountResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[NotificationService] Invalid getUnreadCount response: ${parsed.error.message}`,
      );
    }

    return ok(parsed.data.unreadCount);
  };

  markAsRead = async (notificationId: number): Promise<Result<MarkReadResponse, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/notifications/${notificationId}/read`);

    if (!result.ok) {
      return result;
    }

    const parsed = markReadResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[NotificationService] Invalid markAsRead response: ${parsed.error.message}`,
      );
    }

    return ok(parsed.data);
  };

  markAllAsRead = async (): Promise<Result<MarkReadResponse, ApiError>> => {
    const result = await this.#httpClient.patch('v1/notifications/inbox/read-all');

    if (!result.ok) {
      return result;
    }

    const parsed = markReadResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[NotificationService] Invalid markAllAsRead response: ${parsed.error.message}`,
      );
    }

    return ok(parsed.data);
  };

  markOpened = async (notificationId: number): Promise<Result<boolean, ApiError>> => {
    const result = await this.#httpClient.post(`v1/notifications/${notificationId}/opened`);
    if (!result.ok) {
      return result;
    }
    const parsed = notificationOpenedResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[NotificationService] Invalid markOpened response: ${parsed.error.message}`,
      );
    }
    return ok(parsed.data.opened);
  };

  optOutMarketingPush = async (token: string): Promise<Result<boolean, ApiError>> => {
    const result = await this.#publicHttpClient.post('v1/notifications/marketing-push/opt-out', {
      token,
    });
    if (!result.ok) {
      return result;
    }
    const parsed = marketingPushOptOutResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[NotificationService] Invalid marketing opt-out response: ${parsed.error.message}`,
      );
    }
    return ok(parsed.data.optedOut);
  };

  setBadgeCount = (count: number): Promise<void> => this.#badgeGateway.setBadgeCount(count);

  clearBadge = (): Promise<void> => this.#badgeGateway.setBadgeCount(0);

  syncBadgeCount = async (): Promise<void> => {
    const result = await this.getUnreadCount();
    if (result.ok) {
      await this.setBadgeCount(result.value);
    }
  };
}
