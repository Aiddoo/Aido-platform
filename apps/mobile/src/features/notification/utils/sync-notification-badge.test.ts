import type { Logger } from '@src/core/ports/logger';
import { NetworkError, ServerError } from '@src/shared/errors';

import { syncNotificationBadge } from './sync-notification-badge';

const createRecordingLogger = () => {
  const warnings: string[] = [];
  const errors: string[] = [];
  const logger: Logger = {
    debug: () => {},
    info: () => {},
    warn: (message) => warnings.push(message),
    error: (message) => errors.push(message),
  };
  return { logger, warnings, errors };
};

const createStubNotificationService = (syncBadgeCount: () => Promise<void>) => {
  const calls = { sync: 0, clear: 0 };
  return {
    calls,
    service: {
      syncBadgeCount: () => {
        calls.sync += 1;
        return syncBadgeCount();
      },
      clearBadge: async () => {
        calls.clear += 1;
      },
    },
  };
};

describe('syncNotificationBadge', () => {
  it.each(['loading', 'locked'] as const)(
    '인증을 확인하는 중(%s)에는 배지를 지우지도 맞추지도 않는다',
    async (authStatus) => {
      // Given
      const recorder = createRecordingLogger();
      const stub = createStubNotificationService(async () => {});

      // When
      await syncNotificationBadge({
        authStatus,
        isOnline: true,
        notificationService: stub.service,
        logger: recorder.logger,
      });

      // Then
      expect(stub.calls).toEqual({ sync: 0, clear: 0 });
    },
  );

  it('로그아웃 상태로 확정되면 배지를 지운다', async () => {
    // Given
    const recorder = createRecordingLogger();
    const stub = createStubNotificationService(async () => {});

    // When
    await syncNotificationBadge({
      authStatus: 'unauthenticated',
      isOnline: true,
      notificationService: stub.service,
      logger: recorder.logger,
    });

    // Then
    expect(stub.calls).toEqual({ sync: 0, clear: 1 });
  });

  it('오프라인이면 배지 조회를 건너뛰고 오류를 남기지 않는다', async () => {
    // Given
    const recorder = createRecordingLogger();
    const stub = createStubNotificationService(async () => {});

    // When
    await syncNotificationBadge({
      authStatus: 'authenticated',
      isOnline: false,
      notificationService: stub.service,
      logger: recorder.logger,
    });

    // Then
    expect(stub.calls.sync).toBe(0);
    expect(recorder.errors).toEqual([]);
  });

  it('연결 오류로 실패하면 사용자에게 보이는 오류 대신 경고로만 남긴다', async () => {
    // Given
    const recorder = createRecordingLogger();
    const stub = createStubNotificationService(async () => {
      throw new NetworkError();
    });

    // When
    await syncNotificationBadge({
      authStatus: 'authenticated',
      isOnline: true,
      notificationService: stub.service,
      logger: recorder.logger,
    });

    // Then
    expect(recorder.errors).toEqual([]);
    expect(recorder.warnings).toEqual(['notification.badge-sync.failed']);
  });

  it('서버 오류로 실패하면 오류로 남긴다', async () => {
    // Given
    const recorder = createRecordingLogger();
    const stub = createStubNotificationService(async () => {
      throw new ServerError(503);
    });

    // When
    await syncNotificationBadge({
      authStatus: 'authenticated',
      isOnline: true,
      notificationService: stub.service,
      logger: recorder.logger,
    });

    // Then
    expect(recorder.errors).toEqual(['notification.badge-sync.failed']);
  });
});
