import type { ApiError } from '@src/shared/errors/api-error';
import { ok, type Result } from '@src/shared/errors/result';
import * as Notifications from 'expo-notifications';

import type { NotificationError } from '../models/notification.error';
import type {
  GetNotificationsQuery,
  MarkReadResult,
  NotificationListResult,
  RegisterTokenResult,
} from '../models/notification.model';
import type { NotificationRepository } from '../repositories/notification.repository';
import type { DeviceIdService } from './device-id.service';
import type { PushTokenService } from './push-token.service';

export type NotificationServiceError = ApiError | NotificationError;

export class NotificationService {
  readonly #notificationRepository: NotificationRepository;
  readonly #deviceIdService: DeviceIdService;
  readonly #pushTokenService: PushTokenService;

  constructor(
    notificationRepository: NotificationRepository,
    deviceIdService: DeviceIdService,
    pushTokenService: PushTokenService,
  ) {
    this.#notificationRepository = notificationRepository;
    this.#deviceIdService = deviceIdService;
    this.#pushTokenService = pushTokenService;
  }

  // 푸시 토큰 등록 (로그인 후 호출)
  setupPushNotifications = async (): Promise<
    Result<RegisterTokenResult, NotificationServiceError>
  > => {
    const [tokenResult, deviceId] = await Promise.all([
      this.#pushTokenService.getExpoPushToken(),
      this.#deviceIdService.get(),
    ]);

    if (!tokenResult.ok) return tokenResult;

    if (__DEV__) {
      console.log('[PushToken]', { token: tokenResult.value, deviceId });
    }

    return this.#notificationRepository.registerToken(tokenResult.value, deviceId);
  };

  // 푸시 토큰 해제 (로그아웃 시 호출)
  unregisterPushToken = async (): Promise<Result<void, ApiError>> => {
    const deviceId = await this.#deviceIdService.get();
    return this.#notificationRepository.unregisterToken(deviceId);
  };

  isSupported = (): boolean => this.#pushTokenService.isPhysicalDevice();

  getNotifications = async (
    query?: GetNotificationsQuery,
  ): Promise<Result<NotificationListResult, ApiError>> => {
    return this.#notificationRepository.getNotifications(query);
  };

  getUnreadCount = async (): Promise<Result<number, ApiError>> => {
    const result = await this.#notificationRepository.getUnreadCount();
    if (!result.ok) return result;

    return ok(result.value.unreadCount);
  };

  markAsRead = async (notificationId: number): Promise<Result<MarkReadResult, ApiError>> => {
    return this.#notificationRepository.markAsRead(notificationId);
  };

  markAllAsRead = async (): Promise<Result<MarkReadResult, ApiError>> => {
    return this.#notificationRepository.markAllAsRead();
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
