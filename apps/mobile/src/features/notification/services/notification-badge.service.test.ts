import { createAppLoggerStub, createPushNotificationGatewayStub } from '@src/testing/core';

import { NotificationBadgeService } from './notification-badge.service';

describe('NotificationBadgeService.syncBadge', () => {
  it.each([
    ['loading', 3, null],
    ['locked', 3, null],
    ['unauthenticated', 3, 0],
    ['authenticated', 3, 3],
    ['authenticated', 0, 0],
    ['authenticated', undefined, null],
  ] as const)(
    '인증 상태가 %s이고 서버의 안 읽은 수가 %s면 배지를 %s로 맞춘다(null은 그대로 둔다)',
    async (authStatus, unreadCount, expected) => {
      // Given
      const badgeGateway = createPushNotificationGatewayStub();
      const service = new NotificationBadgeService({
        badge: badgeGateway,
        logger: createAppLoggerStub(),
      });

      // When
      await service.syncBadge({ authStatus, unreadCount });

      // Then
      expect(badgeGateway.setBadgeCount.mock.calls).toEqual(expected == null ? [] : [[expected]]);
    },
  );

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
