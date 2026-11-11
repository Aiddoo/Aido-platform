import {
  createAnalyticsStub,
  createLoggerStub,
  createPurchasesGatewayStub,
} from '@src/testing/core';

import { SUBSCRIPTION_ERROR_CODE } from '../domains/subscription.error';
import { PurchasesSession } from './purchases.session';
import { SubscriptionService } from './subscription.service';

function createConfiguredService() {
  const purchases = createPurchasesGatewayStub();
  const logger = createLoggerStub();
  const session = new PurchasesSession({
    purchases,
    logger,
    analytics: createAnalyticsStub(),
    subscriberAttributes: { appVersion: null, deviceModel: null },
  });
  session.configure();
  return { service: new SubscriptionService(session, purchases, logger), purchases };
}

describe('SubscriptionService', () => {
  it('판매 중인 요금제에 없는 패키지를 사면 요금제를 받을 수 없다는 오류가 된다', async () => {
    // Given
    const { service } = createConfiguredService();

    // When
    const result = await service.purchase('$rc_lifetime');

    // Then
    expect(result).toMatchObject({
      ok: false,
      error: { code: SUBSCRIPTION_ERROR_CODE.OFFERINGS_UNAVAILABLE },
    });
  });

  it('보상 기간만 있는 계정은 복원해도 복원할 구매가 없다', async () => {
    // Given
    const { service, purchases } = createConfiguredService();
    purchases.restore.mockResolvedValue({
      activeEntitlements: [{ store: 'PROMOTIONAL', productIdentifier: 'rc_promo_premium' }],
      managementUrl: null,
    });

    // When
    const result = await service.restorePurchases();

    // Then
    expect(result).toEqual({ ok: true, value: false });
  });

  it('고객 정보 구독을 끝내면 스토어 변경을 더 받지 않는다', () => {
    // Given
    const { service, purchases } = createConfiguredService();
    const listener = jest.fn();
    const unsubscribe = service.subscribeCustomerInfo(listener);

    // When
    unsubscribe();
    purchases.emitCustomerInfo({ activeEntitlements: [], managementUrl: null });

    // Then
    expect(listener).not.toHaveBeenCalled();
    expect(purchases.getListenerCount()).toBe(0);
  });

  it('모르는 값이 실린 구독 갱신은 SDK 콜백으로 예외를 던지지 않고 건너뛴다', () => {
    // Given
    const { service, purchases } = createConfiguredService();
    const listener = jest.fn();
    service.subscribeCustomerInfo(listener);

    // When
    // 새 스토어 값은 타입으로 만들 수 없어 문자열에서 읽는다
    const unknownStoreInfo = JSON.parse(
      '{"activeEntitlements":[{"store":"UNKNOWN_STORE","productIdentifier":"x"}]}',
    );
    const emit = () => purchases.emitCustomerInfo(unknownStoreInfo);

    // Then
    expect(emit).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });
});
