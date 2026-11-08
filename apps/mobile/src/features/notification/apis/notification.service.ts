import {
  marketingPushOptOutResponseSchema,
  markReadResponseSchema,
  notificationInboxResponseSchema,
  notificationOpenedResponseSchema,
  unreadCountResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http-client';
import type { Logger } from '@src/core/ports/logger';
import type { PushNotificationGateway } from '@src/core/ports/push-notification-gateway';
import type { AuthStatus } from '@src/core/session/auth-status';
import { getErrorMessage, isConnectivityError, toError } from '@src/shared/errors';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { identity, withTimeout } from 'es-toolkit';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NOTIFICATION_READ_BUDGET_MS } from '../constants/notification.constants';
import { isForeignNotificationError } from '../domains/notification.error';
import { NotificationPolicy } from '../domains/notification.model';
import type { GetNotificationsQuery, NotificationOwnership } from '../schemas/notification.schema';
import { toNotificationListResult } from './notification.mapper';

interface NotificationServicePorts {
  httpClient: HttpClient;
  badgeGateway: Pick<PushNotificationGateway, 'setBadgeCount'>;
  publicHttpClient: HttpClient;
  logger: Logger;
}

interface SyncBadgeInput {
  authStatus: AuthStatus;
  isOnline: boolean;
}

export class NotificationService {
  readonly #httpClient: HttpClient;
  readonly #badgeGateway: Pick<PushNotificationGateway, 'setBadgeCount'>;
  readonly #publicHttpClient: HttpClient;
  readonly #logger: Logger;

  constructor({ httpClient, badgeGateway, publicHttpClient, logger }: NotificationServicePorts) {
    this.#httpClient = httpClient;
    this.#badgeGateway = badgeGateway;
    this.#publicHttpClient = publicHttpClient;
    this.#logger = logger;
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

  /**
   * 눌린 푸시를 읽음 처리하며 내 알림인지 본다. 예산 안에 답이 없어도 항상 끝난다.
   * 서버 알림 기록이 없는 푸시는 묻지 않는다.
   */
  markAsReadAndCheckOwnership = async (notificationId: number): Promise<NotificationOwnership> => {
    if (!NotificationPolicy.hasServerRecord(notificationId)) {
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

  setBadgeCount = (count: number): Promise<void> => this.#badgeGateway.setBadgeCount(count);

  clearBadge = (): Promise<void> => this.#badgeGateway.setBadgeCount(0);

  syncBadgeCount = async (): Promise<void> => {
    const result = await this.getUnreadCount();
    if (result.ok) {
      await this.setBadgeCount(result.value);
    }
  };

  /** 앱 아이콘 배지를 읽지 않은 알림 수에 맞춘다. 화면 뒤 작업이라 사용자에게 오류를 보이지 않는다 */
  syncBadge = async ({ authStatus, isOnline }: SyncBadgeInput): Promise<void> => {
    // 콜드 스타트의 인증 확인 중(loading·locked)은 로그아웃이 아니다. 지우면 읽지 않은 알림이 있어도 배지가 사라진다
    if (authStatus === 'loading' || authStatus === 'locked') {
      return;
    }

    if (authStatus === 'unauthenticated') {
      await this.clearBadge().catch((error) =>
        this.#logger.error(NOTIFICATION_LOG_EVENT.BADGE_CLEAR_FAILED, toError(error)),
      );
      return;
    }

    // 오프라인이면 건너뛴다. 다시 연결되면 호출부가 한 번 더 맞춘다
    if (!isOnline) {
      return;
    }

    try {
      await this.syncBadgeCount();
    } catch (error) {
      if (isConnectivityError(error)) {
        this.#logger.warn(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, {
          error: getErrorMessage(error),
        });
        return;
      }
      this.#logger.error(NOTIFICATION_LOG_EVENT.BADGE_SYNC_FAILED, toError(error));
    }
  };
}
