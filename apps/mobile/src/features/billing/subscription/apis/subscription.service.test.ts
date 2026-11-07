import {
  createAnalyticsStub,
  createLoggerStub,
  createPurchasesGatewayStub,
} from '@src/shared/__tests__';

import { SubscriptionErrorCode } from '../domains/subscription.error';
import { PurchasesSdkManager } from './purchases-sdk-manager';
import { SubscriptionService } from './subscription.service';

function createConfiguredService() {
  const purchases = createPurchasesGatewayStub();
  const logger = createLoggerStub();
  const sdkManager = new PurchasesSdkManager({
    purchases,
    logger,
    analytics: createAnalyticsStub(),
    subscriberAttributes: { appVersion: null, deviceModel: null },
  });
  sdkManager.configure();
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
    purchases.restore.mockResolvedValue({
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
