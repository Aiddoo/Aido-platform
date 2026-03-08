import type { HttpClient } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';
import * as Notifications from 'expo-notifications';

import type { NotificationError } from '../models/notification.error';
import type {
  GetNotificationsQuery,
  MarkReadResult,
  NotificationListResult,
  RegisterTokenResult,
} from '../models/notification.model';
import {
  markReadResultSchema,
  notificationListResponseSchema,
  registerTokenResultSchema,
  unreadCountResultSchema,
} from '../models/notification.model';
import type { DeviceIdService } from './device-id.service';
import { toNotificationListResult } from './notification.mapper';
import type { PushTokenService } from './push-token.service';

export type NotificationServiceError = ApiError | NotificationError;

export class NotificationService {
  readonly #httpClient: HttpClient;
  readonly #deviceIdService: DeviceIdService;
  readonly #pushTokenService: PushTokenService;
  readonly #logger: Logger;

  constructor(
    httpClient: HttpClient,
    deviceIdService: DeviceIdService,
    pushTokenService: PushTokenService,
    logger: Logger,
  ) {
    this.#httpClient = httpClient;
    this.#deviceIdService = deviceIdService;
    this.#pushTokenService = pushTokenService;
    this.#logger = logger;
  }

  setupPushNotifications = async (): Promise<
    Result<RegisterTokenResult, NotificationServiceError>
  > => {
    const [tokenResult, deviceId] = await Promise.all([
      this.#pushTokenService.getExpoPushToken(),
      this.#deviceIdService.get(),
    ]);

    if (!tokenResult.ok) {
      return tokenResult;
    }

    this.#logger.debug('[PushToken] Registering', { token: tokenResult.value, deviceId });

    const result = await this.#httpClient.post<unknown>('v1/notifications/token', {
      token: tokenResult.value,
      deviceId,
    });

    if (!result.ok) {
      return result;
    }

    const parsed = registerTokenResultSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[NotificationService] Invalid registerToken response: ${parsed.error.message}`,
      );
    }

    return ok(parsed.data);
  };

  unregisterPushToken = async (): Promise<Result<void, ApiError>> => {
    const deviceId = await this.#deviceIdService.get();
    const result = await this.#httpClient.delete<unknown>(
      'v1/notifications/token',
      deviceId ? { params: { deviceId } } : undefined,
    );

    if (!result.ok) {
      return result;
    }

    return ok(undefined);
  };

  isSupported = (): boolean => this.#pushTokenService.isPhysicalDevice();

  getNotifications = async (
    query?: GetNotificationsQuery,
  ): Promise<Result<NotificationListResult, ApiError>> => {
    const result = await this.#httpClient.get<unknown>('v1/notifications', {
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

    const parsed = notificationListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[NotificationService] Invalid getNotifications response: ${parsed.error.message}`,
      );
    }

    return ok(toNotificationListResult(parsed.data));
  };

  getUnreadCount = async (): Promise<Result<number, ApiError>> => {
    const result = await this.#httpClient.get<unknown>('v1/notifications/unread-count');

    if (!result.ok) {
      return result;
    }

    const parsed = unreadCountResultSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[NotificationService] Invalid getUnreadCount response: ${parsed.error.message}`,
      );
    }

    return ok(parsed.data.unreadCount);
  };

  markAsRead = async (notificationId: number): Promise<Result<MarkReadResult, ApiError>> => {
    const result = await this.#httpClient.patch<unknown>(`v1/notifications/${notificationId}/read`);

    if (!result.ok) {
      return result;
    }

    const parsed = markReadResultSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[NotificationService] Invalid markAsRead response: ${parsed.error.message}`,
      );
    }

    return ok(parsed.data);
  };

  markAllAsRead = async (): Promise<Result<MarkReadResult, ApiError>> => {
    const result = await this.#httpClient.patch<unknown>('v1/notifications/read-all');

    if (!result.ok) {
      return result;
    }

    const parsed = markReadResultSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[NotificationService] Invalid markAllAsRead response: ${parsed.error.message}`,
      );
    }

    return ok(parsed.data);
  };

  setBadgeCount = async (count: number): Promise<void> => {
    await Notifications.setBadgeCountAsync(count);
  };

  clearBadge = async (): Promise<void> => {
    await Notifications.setBadgeCountAsync(0);
  };

  syncBadgeCount = async (): Promise<void> => {
    const result = await this.getUnreadCount();
    if (result.ok) {
      await this.setBadgeCount(result.value);
    }
  };
}
