import { ok } from '@src/core/errors/result';
import {
  createHttpClientStub,
  createLoggerStub,
  createPushNotificationGatewayStub,
} from '@src/shared/__tests__';
import { NetworkError, ServerError } from '@src/shared/errors';

import { createUnreadCountResponseDto } from '../__tests__/notification.fixtures';
import { NotificationBadgeService } from './notification-badge.service';
import { NotificationService } from './notification.service';

describe('NotificationBadgeService.syncBadge', () => {
  function setup() {
    const httpClient = createHttpClientStub();
    const badgeGateway = createPushNotificationGatewayStub();
    const logger = createLoggerStub();
    return {
      httpClient,
      badgeGateway,
      logger,
      service: new NotificationBadgeService({
        badgeGateway,
        notificationService: new NotificationService({ httpClient, publicHttpClient: httpClient }),
        logger,
      }),
    };
  }

  it.each(['loading', 'locked'] as const)(
    '인증을 확인하는 중(%s)에는 배지를 지우지도 맞추지도 않는다',
    async (authStatus) => {
      // Given
      const { httpClient, badgeGateway, service } = setup();

      // When
      await service.syncBadge({ authStatus, isOnline: true });

      // Then
      expect(httpClient.get).not.toHaveBeenCalled();
      expect(badgeGateway.setBadgeCount).not.toHaveBeenCalled();
    },
  );

  it('로그아웃 상태로 확정되면 배지를 지운다', async () => {
    // Given
    const { httpClient, badgeGateway, service } = setup();

    // When
    await service.syncBadge({ authStatus: 'unauthenticated', isOnline: true });

    // Then
    expect(httpClient.get).not.toHaveBeenCalled();
    expect(badgeGateway.setBadgeCount).toHaveBeenCalledWith(0);
  });

  it('로그인 상태면 읽지 않은 알림 수로 배지를 맞춘다', async () => {
    // Given
    const { httpClient, badgeGateway, service } = setup();
    httpClient.get.mockResolvedValue(ok(createUnreadCountResponseDto({ unreadCount: 3 })));

    // When
    await service.syncBadge({ authStatus: 'authenticated', isOnline: true });

    // Then
    expect(badgeGateway.setBadgeCount).toHaveBeenCalledWith(3);
  });

  it('오프라인이면 배지 조회를 건너뛰고 오류를 남기지 않는다', async () => {
    // Given
    const { httpClient, logger, service } = setup();

    // When
    await service.syncBadge({ authStatus: 'authenticated', isOnline: false });

    // Then
    expect(httpClient.get).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('연결 오류로 실패하면 사용자에게 보이는 오류 대신 경고로만 남긴다', async () => {
    // Given
    const { httpClient, logger, service } = setup();
    httpClient.get.mockRejectedValue(new NetworkError());

    // When
    await service.syncBadge({ authStatus: 'authenticated', isOnline: true });

    // Then
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('notification.badge-sync.failed', expect.any(Object));
  });

  it('서버 오류로 실패하면 오류로 남긴다', async () => {
    // Given
    const { httpClient, logger, service } = setup();
    httpClient.get.mockRejectedValue(new ServerError(503));

    // When
    await service.syncBadge({ authStatus: 'authenticated', isOnline: true });

    // Then
    expect(logger.error).toHaveBeenCalledWith('notification.badge-sync.failed', expect.any(Error));
  });
});
