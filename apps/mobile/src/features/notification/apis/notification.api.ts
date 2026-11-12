import {
  markReadResponseSchema,
  notificationInboxResponseSchema,
  notificationOpenedResponseSchema,
  unreadCountResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { withTimeout } from 'es-toolkit';

import { NOTIFICATION_READ_BUDGET_MS } from '../constants/notification.constants';
import { isForeignNotificationError } from '../domains/notification.error';
import type { NotificationOwnership } from '../domains/notification.model';
import { isServerNotificationId } from '../domains/push-notification.model';
import type { GetNotificationsQuery } from '../schemas/get-notifications-request.schema';
import { marketingPushOptOutEnvelopeSchema } from '../schemas/marketing-push-opt-out-response.schema';
import {
  toMarketingPushOptOutResult,
  toNotificationPage,
  toReadCount,
} from './notification.mapper';

interface NotificationApiPorts {
  authHttpClient: HttpClient;
  publicHttpClient: HttpClient;
}

export class NotificationApi {
  readonly #authHttpClient: HttpClient;
  readonly #publicHttpClient: HttpClient;

  constructor({ authHttpClient, publicHttpClient }: NotificationApiPorts) {
    this.#authHttpClient = authHttpClient;
    this.#publicHttpClient = publicHttpClient;
  }

  getNotifications = async (query?: GetNotificationsQuery, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#authHttpClient.get('v1/notifications/inbox', {
        signal,
        params: {
          limit: query?.limit,
          cursor: query?.cursor,
          category: query?.category,
          unreadOnly: query?.unreadOnly,
        },
      }),
      notificationInboxResponseSchema,
      toNotificationPage,
      '[NotificationApi] Invalid getNotifications response',
    );

  getUnreadCount = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#authHttpClient.get('v1/notifications/inbox/unread-count', { signal }),
      unreadCountResponseSchema,
      (dto) => dto.unreadCount,
      '[NotificationApi] Invalid getUnreadCount response',
    );

  markAsRead = async (notificationId: number) =>
    parseApiResponse(
      await this.#authHttpClient.patch(`v1/notifications/${notificationId}/read`),
      markReadResponseSchema,
      toReadCount,
      '[NotificationApi] Invalid markAsRead response',
    );

  markAllAsRead = async () =>
    parseApiResponse(
      await this.#authHttpClient.patch('v1/notifications/inbox/read-all'),
      markReadResponseSchema,
      toReadCount,
      '[NotificationApi] Invalid markAllAsRead response',
    );

  markOpened = async (notificationId: number) =>
    parseApiResponse(
      await this.#authHttpClient.post(`v1/notifications/${notificationId}/opened`),
      notificationOpenedResponseSchema,
      (dto) => dto.opened,
      '[NotificationApi] Invalid markOpened response',
    );

  optOutMarketingPush = async (token: string) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/notifications/marketing-push/opt-out', { token }),
      marketingPushOptOutEnvelopeSchema,
      toMarketingPushOptOutResult,
      '[NotificationApi] Invalid marketing opt-out response',
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
