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
  const calls = { sync: 0 };
  return {
    calls,
    service: {
      syncBadgeCount: () => {
        calls.sync += 1;
        return syncBadgeCount();
      },
      clearBadge: async () => {},
    },
  };
};

describe('syncNotificationBadge', () => {
  it('오프라인이면 배지 조회를 건너뛰고 오류를 남기지 않는다', async () => {
    // Given
    const recorder = createRecordingLogger();
    const stub = createStubNotificationService(async () => {});

    // When
    await syncNotificationBadge({
      isAuthenticated: true,
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
      isAuthenticated: true,
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
      isAuthenticated: true,
      isOnline: true,
      notificationService: stub.service,
      logger: recorder.logger,
    });

    // Then
    expect(recorder.errors).toEqual(['notification.badge-sync.failed']);
  });
});
