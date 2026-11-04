import type { Logger } from '@src/core/ports/logger';
import { createMockAnalytics, createPurchasesGatewayStub } from '@src/shared/__tests__';

import { SubscriptionErrorCode } from '../domains/subscription.error';
import { RevenueCatSdkManager } from './revenuecat-sdk-manager';
import { SubscriptionService } from './subscription.service';

const createLogger = (): jest.Mocked<Logger> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

function createConfiguredService() {
  const purchases = createPurchasesGatewayStub();
  const logger = createLogger();
  const sdkManager = new RevenueCatSdkManager({
    purchases,
    logger,
    analytics: createMockAnalytics(),
    subscriberAttributes: { appVersion: null, deviceModel: null },
    isDebugLogEnabled: false,
  });
  sdkManager.configure('api-key');
  return { service: new SubscriptionService(sdkManager, purchases, logger), purchases };
}

describe('SubscriptionService', () => {
  test('판매 중인 요금제에 없는 패키지를 사면 요금제를 받을 수 없다는 오류가 된다', async () => {
    // Given
    const { service } = createConfiguredService();

    // When
    const result = await service.purchase('$rc_lifetime');

    // Then
    expect(result).toMatchObject({
      ok: false,
      error: { code: SubscriptionErrorCode.OFFERINGS_UNAVAILABLE },
    });
  });

  test('보상 기간만 있는 계정은 복원해도 복원할 구매가 없다', async () => {
    // Given
    const { service, purchases } = createConfiguredService();
    purchases.restorePurchases.mockResolvedValue({
      activeEntitlements: [{ store: 'PROMOTIONAL', productIdentifier: 'rc_promo_premium' }],
    });

    // When
    const result = await service.restorePurchases();

    // Then
    expect(result).toEqual({ ok: true, value: false });
  });

  test('고객 정보 구독을 끝내면 스토어 변경을 더 받지 않는다', () => {
    // Given
    const { service, purchases } = createConfiguredService();
    const listener = jest.fn();
    const unsubscribe = service.subscribeCustomerInfo(listener);

    // When
    unsubscribe();
    purchases.emitCustomerInfo({ activeEntitlements: [] });

    // Then
    expect(listener).not.toHaveBeenCalled();
    expect(purchases.getListenerCount()).toBe(0);
  });
});
