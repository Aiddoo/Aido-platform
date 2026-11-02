import type { Logger } from '@src/core/ports/logger';
import { createMockAnalytics } from '@src/shared/__tests__';
import Purchases from 'react-native-purchases';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import { RevenueCatSdkManager } from './revenuecat-sdk-manager';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  LOG_LEVEL: { WARN: 'WARN' },
  default: {
    setLogLevel: jest.fn(),
    configure: jest.fn(),
    logIn: jest.fn(),
    setFirebaseAppInstanceID: jest.fn(),
    setAttributes: jest.fn(),
  },
}));

jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.14.0' }));
jest.mock('expo-device', () => ({ modelName: 'iPhone 17' }));

const purchases = jest.mocked(Purchases);

const createLogger = (): jest.Mocked<Logger> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('RevenueCat 구독자 속성', () => {
  test('로그인하면 운영 알림에 쓸 앱 버전과 기기 모델을 설정한다', async () => {
    // Given
    purchases.setAttributes.mockResolvedValue(undefined);
    const manager = new RevenueCatSdkManager(createLogger(), createMockAnalytics());
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
    const logger = createLogger();
    purchases.setAttributes.mockRejectedValue(new Error('network'));
    const manager = new RevenueCatSdkManager(logger, createMockAnalytics());
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
  beforeEach(() => {
    purchases.setFirebaseAppInstanceID.mockResolvedValue(undefined);
  });

  test('SDK 초기화 후 Firebase 앱 인스턴스 ID를 RevenueCat에 설정한다', async () => {
    // Given
    const analytics = createMockAnalytics();
    analytics.getAppInstanceId.mockResolvedValue('instance-1');
    const manager = new RevenueCatSdkManager(createLogger(), analytics);

    // When
    manager.configure('api-key');
    await flushPromises();

    // Then
    expect(purchases.setFirebaseAppInstanceID).toHaveBeenCalledWith('instance-1');
  });

  test('로그인 후 바뀐 사용자에게도 앱 인스턴스 ID를 다시 설정한다', async () => {
    // Given
    const analytics = createMockAnalytics();
    analytics.getAppInstanceId.mockResolvedValue('instance-1');
    const manager = new RevenueCatSdkManager(createLogger(), analytics);
    manager.configure('api-key');
    await flushPromises();
    purchases.setFirebaseAppInstanceID.mockClear();

    // When
    await manager.logIn('user-1');

    // Then
    expect(purchases.setFirebaseAppInstanceID).toHaveBeenCalledWith('instance-1');
  });

  test('앱 인스턴스 ID가 없으면 RevenueCat 속성을 건드리지 않는다', async () => {
    // Given
    const manager = new RevenueCatSdkManager(createLogger(), createMockAnalytics());

    // When
    manager.configure('api-key');
    await flushPromises();

    // Then
    expect(purchases.setFirebaseAppInstanceID).not.toHaveBeenCalled();
  });

  test('앱 인스턴스 ID 설정이 실패해도 예외 없이 경고만 남긴다', async () => {
    // Given
    const logger = createLogger();
    const analytics = createMockAnalytics();
    analytics.getAppInstanceId.mockRejectedValue(new Error('analytics disabled'));
    const manager = new RevenueCatSdkManager(logger, analytics);
    manager.configure('api-key');
    await flushPromises();

    // When
    await manager.logIn('user-1');

    // Then
    expect(logger.warn).toHaveBeenCalledWith(
      SUBSCRIPTION_LOG_EVENT.REVENUECAT_FIREBASE_APP_INSTANCE_ID_SYNC_FAILED,
      { error: 'analytics disabled' },
    );
    expect(purchases.setFirebaseAppInstanceID).not.toHaveBeenCalled();
  });
});
