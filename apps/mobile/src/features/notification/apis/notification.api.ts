import {
  markReadResponseSchema,
  notificationInboxResponseSchema,
  notificationOpenedResponseSchema,
  todoReminderSnoozeResponseSchema,
  unreadCountResponseSchema,
} from '@aido/api/contracts/notification/v1';
import type { HttpClient } from '@src/core/ports/http-client';
import { toInstant } from '@src/shared/date/instant';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { withTimeout } from 'es-toolkit';

import { NOTIFICATION_READ_BUDGET_MS } from '../constants/notification.constants';
import { isForeignNotificationError } from '../domains/notification.error';
import type { NotificationOwnership } from '../domains/notification.model';
import { isServerNotificationId } from '../domains/push-notification.model';
import { marketingPushOptOutEnvelopeSchema } from '../schemas/marketing-push-opt-out-response.schema';
import type { GetNotificationsQuery } from '../schemas/notification-list-request.schema';
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

  // 누른 알림 id가 서버의 예약 key라 같은 알림을 두 번 보내도 다시 알림은 하나다
  snoozeTodoReminder = async (todoId: number, notificationId: number) =>
    parseApiResponse(
      await this.#authHttpClient.post(`v1/todo-reminders/${todoId}/snoozes`, { notificationId }),
      todoReminderSnoozeResponseSchema,
      (dto) => toInstant(dto.remindAt),
      '[NotificationApi] Invalid snoozeTodoReminder response',
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
