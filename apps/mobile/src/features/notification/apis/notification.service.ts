import {
  marketingPushOptOutResponseSchema,
  markReadResponseSchema,
  notificationInboxResponseSchema,
  notificationOpenedResponseSchema,
  unreadCountResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { PushNotificationGateway } from '@src/core/ports/push-notification-gateway';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { identity } from 'es-toolkit';

import type { GetNotificationsQuery } from '../schemas/notification.schema';
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

  getNotifications = async (query?: GetNotificationsQuery, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/notifications/inbox', {
        signal,
        params: {
          limit: query?.limit,
          cursor: query?.cursor,
          category: query?.category,
          unreadOnly: query?.unreadOnly,
        },
      }),
      notificationInboxResponseSchema,
      toNotificationListResult,
      '[NotificationService] Invalid getNotifications response',
    );

  getUnreadCount = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/notifications/inbox/unread-count', { signal }),
      unreadCountResponseSchema,
      (dto) => dto.unreadCount,
      '[NotificationService] Invalid getUnreadCount response',
    );

  markAsRead = async (notificationId: number) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/notifications/${notificationId}/read`),
      markReadResponseSchema,
      identity,
      '[NotificationService] Invalid markAsRead response',
    );

  markAllAsRead = async () =>
    parseApiResponse(
      await this.#httpClient.patch('v1/notifications/inbox/read-all'),
      markReadResponseSchema,
      identity,
      '[NotificationService] Invalid markAllAsRead response',
    );

  markOpened = async (notificationId: number) =>
    parseApiResponse(
      await this.#httpClient.post(`v1/notifications/${notificationId}/opened`),
      notificationOpenedResponseSchema,
      (dto) => dto.opened,
      '[NotificationService] Invalid markOpened response',
    );

  optOutMarketingPush = async (token: string) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/notifications/marketing-push/opt-out', { token }),
      marketingPushOptOutResponseSchema,
      (dto) => dto.optedOut,
      '[NotificationService] Invalid marketing opt-out response',
    );

  setBadgeCount = (count: number): Promise<void> => this.#badgeGateway.setBadgeCount(count);

  clearBadge = (): Promise<void> => this.#badgeGateway.setBadgeCount(0);

  syncBadgeCount = async (): Promise<void> => {
    const result = await this.getUnreadCount();
    if (result.ok) {
      await this.setBadgeCount(result.value);
    }
  };
}
