import type { Logger } from '@src/core/ports/logger';
import { createMockAnalytics, createPurchasesGatewayStub } from '@src/shared/__tests__';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import { RevenueCatSdkManager } from './revenuecat-sdk-manager';

const createLogger = (): jest.Mocked<Logger> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

function createManager({
  purchases = createPurchasesGatewayStub(),
  logger = createLogger(),
  analytics = createMockAnalytics(),
} = {}) {
  const manager = new RevenueCatSdkManager({
    purchases,
    logger,
    analytics,
    subscriberAttributes: { appVersion: '1.14.0', deviceModel: 'iPhone 17' },
    isDebugLogEnabled: false,
  });
  return { manager, purchases, logger, analytics };
}

describe('RevenueCat 구독자 속성', () => {
  test('로그인하면 운영 알림에 쓸 앱 버전과 기기 모델을 설정한다', async () => {
    // Given
    const { manager, purchases } = createManager();
    manager.configure('api-key');
    await flushPromises();
    purchases.setAttributes.mockClear();

    // When
    await manager.logIn('user-1');

    // Then
    expect(purchases.setAttributes).toHaveBeenCalledWith({
      appVersion: '1.14.0',
      deviceModel: 'iPhone 17',
    });
  });

  test('속성 설정이 실패해도 로그인은 이어지고 경고만 남긴다', async () => {
    // Given
    const { manager, purchases, logger } = createManager();
    purchases.setAttributes.mockRejectedValue(new Error('network'));
    manager.configure('api-key');
    await flushPromises();

    // When
    await manager.logIn('user-1');

    // Then
    expect(logger.warn).toHaveBeenCalledWith(
      SUBSCRIPTION_LOG_EVENT.REVENUECAT_SUBSCRIBER_ATTRIBUTES_SYNC_FAILED,
      { error: 'network' },
    );
  });
});

describe('RevenueCat Firebase 앱 인스턴스 ID 연동', () => {
  test('SDK 초기화 후 Firebase 앱 인스턴스 ID를 RevenueCat에 설정한다', async () => {
    // Given
    const analytics = createMockAnalytics();
    analytics.getAppInstanceId.mockResolvedValue('instance-1');
    const { manager, purchases } = createManager({ analytics });

    // When
    manager.configure('api-key');
    await flushPromises();

    // Then
    expect(purchases.setFirebaseAppInstanceId).toHaveBeenCalledWith('instance-1');
  });

  test('로그인 후 바뀐 사용자에게도 앱 인스턴스 ID를 다시 설정한다', async () => {
    // Given
    const analytics = createMockAnalytics();
    analytics.getAppInstanceId.mockResolvedValue('instance-1');
    const { manager, purchases } = createManager({ analytics });
    manager.configure('api-key');
    await flushPromises();
    purchases.setFirebaseAppInstanceId.mockClear();

    // When
    await manager.logIn('user-1');

    // Then
    expect(purchases.setFirebaseAppInstanceId).toHaveBeenCalledWith('instance-1');
  });

  test('앱 인스턴스 ID가 없으면 RevenueCat 속성을 건드리지 않는다', async () => {
    // Given
    const { manager, purchases } = createManager();

    // When
    manager.configure('api-key');
    await flushPromises();

    // Then
    expect(purchases.setFirebaseAppInstanceId).not.toHaveBeenCalled();
  });

  test('앱 인스턴스 ID 설정이 실패해도 예외 없이 경고만 남긴다', async () => {
    // Given
    const analytics = createMockAnalytics();
    analytics.getAppInstanceId.mockRejectedValue(new Error('analytics disabled'));
    const { manager, purchases, logger } = createManager({ analytics });
    manager.configure('api-key');
    await flushPromises();

    // When
    await manager.logIn('user-1');

    // Then
    expect(logger.warn).toHaveBeenCalledWith(
      SUBSCRIPTION_LOG_EVENT.REVENUECAT_FIREBASE_APP_INSTANCE_ID_SYNC_FAILED,
      { error: 'analytics disabled' },
    );
    expect(purchases.setFirebaseAppInstanceId).not.toHaveBeenCalled();
  });
});
