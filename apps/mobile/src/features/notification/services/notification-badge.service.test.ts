import { createAppLoggerStub, createPushNotificationGatewayStub } from '@src/testing/core';

import { NotificationBadgeService } from './notification-badge.service';

describe('NotificationBadgeService.syncBadge', () => {
  it('런처가 배지 호출을 거부해도 던지지 않고 경고로만 남긴다', async () => {
    // Given
    const badgeGateway = createPushNotificationGatewayStub();
    badgeGateway.setBadgeCount.mockRejectedValue(new Error('unsupported launcher'));
    const logger = createAppLoggerStub();
    const service = new NotificationBadgeService({ badge: badgeGateway, logger });

    // When
    await service.syncBadge({ authStatus: 'authenticated', unreadCount: 2 });

    // Then
    expect(logger.warn).toHaveBeenCalledWith('notification.badge-sync.failed', {
      error: 'unsupported launcher',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });
});
