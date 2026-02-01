import * as Notifications from 'expo-notifications';

import type {
  GetNotificationsQuery,
  MarkReadResult,
  NotificationListResult,
  RegisterTokenResult,
} from '../models/notification.model';
import type { NotificationRepository } from '../repositories/notification.repository';
import type { DeviceIdService } from './device-id.service';
import { NotificationMapper } from './notification.mapper';
import type { PushTokenService } from './push-token.service';

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
  setupPushNotifications = async (): Promise<RegisterTokenResult> => {
    const [token, deviceId] = await Promise.all([
      this.#pushTokenService.getExpoPushToken(),
      this.#deviceIdService.get(),
    ]);

    return this.#notificationRepository.registerToken(token, deviceId);
  };

  // 푸시 토큰 해제 (로그아웃 시 호출)
  unregisterPushToken = async (): Promise<void> => {
    const deviceId = await this.#deviceIdService.get();
    await this.#notificationRepository.unregisterToken(deviceId);
  };

  isSupported = (): boolean => this.#pushTokenService.isPhysicalDevice();

  getNotifications = async (query?: GetNotificationsQuery): Promise<NotificationListResult> => {
    const response = await this.#notificationRepository.getNotifications(query);
    return NotificationMapper.toNotificationListResult(response);
  };

  getUnreadCount = async (): Promise<number> => {
    const result = await this.#notificationRepository.getUnreadCount();
    return result.unreadCount;
  };

  markAsRead = async (notificationId: number): Promise<MarkReadResult> => {
    return this.#notificationRepository.markAsRead(notificationId);
  };

  markAllAsRead = async (): Promise<MarkReadResult> => {
    return this.#notificationRepository.markAllAsRead();
  };

  setBadgeCount = async (count: number): Promise<void> => {
    await Notifications.setBadgeCountAsync(count);
  };

  clearBadge = async (): Promise<void> => {
    await Notifications.setBadgeCountAsync(0);
  };

  syncBadgeCount = async (): Promise<void> => {
    const unreadCount = await this.getUnreadCount();
    await this.setBadgeCount(unreadCount);
  };
}
