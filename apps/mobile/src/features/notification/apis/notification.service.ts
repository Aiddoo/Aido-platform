import {
  marketingPushOptOutResponseSchema,
  markReadResponseSchema,
  notificationInboxResponseSchema,
  notificationOpenedResponseSchema,
  unreadCountResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { identity, withTimeout } from 'es-toolkit';

import { NOTIFICATION_READ_BUDGET_MS } from '../constants/notification.constants';
import { isForeignNotificationError } from '../domains/notification.error';
import { isServerNotificationId } from '../domains/notification.model';
import type { NotificationOwnership } from '../domains/notification.model';
import type { GetNotificationsQuery } from '../schemas/get-notifications-request.schema';
import { toMarketingPushOptOutResult, toNotificationListResult } from './notification.mapper';

interface NotificationServicePorts {
  httpClient: HttpClient;
  publicHttpClient: HttpClient;
}

export class NotificationService {
  readonly #httpClient: HttpClient;
  readonly #publicHttpClient: HttpClient;

  constructor({ httpClient, publicHttpClient }: NotificationServicePorts) {
    this.#httpClient = httpClient;
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
      toMarketingPushOptOutResult,
      '[NotificationService] Invalid marketing opt-out response',
    );

  // 예산 안에 답이 없어도 항상 끝나고, 서버 알림 기록이 없는 푸시는 묻지 않는다
  markAsReadAndCheckOwnership = async (notificationId: number): Promise<NotificationOwnership> => {
    if (!isServerNotificationId(notificationId)) {
      return 'ok';
    }
    try {
      const result = await withTimeout(
        () => this.markAsRead(notificationId),
        NOTIFICATION_READ_BUDGET_MS,
      );
      if (result.ok) {
        return 'ok';
      }
      return isForeignNotificationError(result.error) ? 'foreign' : 'unknown';
    } catch {
      return 'unknown';
    }
  };
}
