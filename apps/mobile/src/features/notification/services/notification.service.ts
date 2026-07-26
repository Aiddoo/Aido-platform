import {
  type MarkReadResponse,
  marketingPushOptOutResponseSchema,
  markReadResponseSchema,
  notificationListResponseSchema,
  notificationOpenedResponseSchema,
  type RegisterTokenResponse,
  registerTokenResponseSchema,
  unreadCountResponseSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';
import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';

import type { NotificationError } from '../models/notification.error';
import type { GetNotificationsQuery, NotificationListResult } from '../models/notification.model';
import type { DeviceIdService } from './device-id.service';
import { toNotificationListResult } from './notification.mapper';
import type { PushTokenService } from './push-token.service';

export type NotificationServiceError = ApiError | NotificationError;

export class NotificationService {
  readonly #httpClient: HttpClient;
  readonly #deviceIdService: DeviceIdService;
  readonly #pushTokenService: PushTokenService;
  readonly #logger: Logger;
  readonly #publicHttpClient: HttpClient;

  constructor(
    httpClient: HttpClient,
    deviceIdService: DeviceIdService,
    pushTokenService: PushTokenService,
    logger: Logger,
    publicHttpClient: HttpClient = httpClient,
  ) {
    this.#httpClient = httpClient;
    this.#deviceIdService = deviceIdService;
    this.#pushTokenService = pushTokenService;
    this.#logger = logger;
    this.#publicHttpClient = publicHttpClient;
  }

  setupPushNotifications = async (
    options: { requestPermission?: boolean } = {},
  ): Promise<Result<RegisterTokenResponse, NotificationServiceError>> => {
    const [tokenResult, deviceId] = await Promise.all([
      this.#pushTokenService.getExpoPushToken({
        requestPermission: options.requestPermission ?? true,
      }),
      this.#deviceIdService.get(),
    ]);

    if (!tokenResult.ok) {
      return tokenResult;
    }

    this.#logger.debug('[PushToken] Registering', { payloadVersion: 2 });

    const result = await this.#httpClient.post<unknown>('v1/notifications/token', {
      token: tokenResult.value,
      deviceId,
      payloadVersion: 2,
      appVersion: Application.nativeApplicationVersion ?? undefined,
    });

    if (!result.ok) {
      return result;
    }

    const parsed = registerTokenResponseSchema.safeParse(result.value);
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

    const parsed = unreadCountResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[NotificationService] Invalid getUnreadCount response: ${parsed.error.message}`,
      );
    }

    return ok(parsed.data.unreadCount);
  };

  markAsRead = async (notificationId: number): Promise<Result<MarkReadResponse, ApiError>> => {
    const result = await this.#httpClient.patch<unknown>(`v1/notifications/${notificationId}/read`);

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
    const result = await this.#httpClient.patch<unknown>('v1/notifications/read-all');

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
    const result = await this.#httpClient.post<unknown>(
      `v1/notifications/${notificationId}/opened`,
    );
    if (!result.ok) return result;
    const parsed = notificationOpenedResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[NotificationService] Invalid markOpened response: ${parsed.error.message}`,
      );
    }
    return ok(parsed.data.opened);
  };

  optOutMarketingPush = async (token: string): Promise<Result<boolean, ApiError>> => {
    const result = await this.#publicHttpClient.post<unknown>(
      'v1/notifications/marketing-push/opt-out',
      { token },
    );
    if (!result.ok) return result;
    const parsed = marketingPushOptOutResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[NotificationService] Invalid marketing opt-out response: ${parsed.error.message}`,
      );
    }
    return ok(parsed.data.optedOut);
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
