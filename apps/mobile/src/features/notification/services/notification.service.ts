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
  constructor(
    private readonly _notificationRepository: NotificationRepository,
    private readonly _deviceIdService: DeviceIdService,
    private readonly _pushTokenService: PushTokenService,
  ) {}

  // 푸시 토큰 등록 (로그인 후 호출)
  setupPushNotifications = async (): Promise<RegisterTokenResult> => {
    const [token, deviceId] = await Promise.all([
      this._pushTokenService.getExpoPushToken(),
      this._deviceIdService.get(),
    ]);

    return this._notificationRepository.registerToken(token, deviceId);
  };

  // 푸시 토큰 해제 (로그아웃 시 호출)
  unregisterPushToken = async (): Promise<void> => {
    const deviceId = await this._deviceIdService.get();
    await this._notificationRepository.unregisterToken(deviceId);
  };

  isSupported = (): boolean => this._pushTokenService.isPhysicalDevice();

  getNotifications = async (query?: GetNotificationsQuery): Promise<NotificationListResult> => {
    const response = await this._notificationRepository.getNotifications(query);
    return NotificationMapper.toNotificationListResult(response);
  };

  getUnreadCount = async (): Promise<number> => {
    const result = await this._notificationRepository.getUnreadCount();
    return result.unreadCount;
  };

  markAsRead = async (notificationId: number): Promise<MarkReadResult> => {
    return this._notificationRepository.markAsRead(notificationId);
  };

  markAllAsRead = async (): Promise<MarkReadResult> => {
    return this._notificationRepository.markAllAsRead();
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
