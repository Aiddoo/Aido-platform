import {
  createAnalyticsStub,
  createAppLoggerStub,
  createPurchasesGatewayStub,
} from '@src/testing/core';

import { SUBSCRIPTION_ERROR_CODE } from '../domains/subscription.error';
import { PurchasesSession } from './purchases.session';
import { SubscriptionService } from './subscription.service';

function createConfiguredService() {
  const purchases = createPurchasesGatewayStub();
  const logger = createAppLoggerStub();
  const session = new PurchasesSession({
    purchases,
    logger,
    analytics: createAnalyticsStub(),
    subscriberAttributes: { appVersion: null, deviceModel: null },
  });
  session.configure();
  return { service: new SubscriptionService(session, purchases, logger), purchases, session };
}

describe('SubscriptionService', () => {
  it('판매 중인 요금제에 없는 패키지를 사면 요금제를 받을 수 없다는 오류가 된다', async () => {
    // Given
    const { service, session } = createConfiguredService();
    await session.logIn('user-1');

    // When
    const result = await service.purchase('$rc_lifetime');

    // Then
    expect(result).toMatchObject({
      ok: false,
      error: { code: SUBSCRIPTION_ERROR_CODE.OFFERINGS_UNAVAILABLE },
    });
  });

  it('계정을 바꾼 결제 SDK 로그인이 끝나기 전에 결제하면 끝난 뒤 결제 창을 연다', async () => {
    // Given
    const { service, session, purchases } = createConfiguredService();
    await session.logIn('user-a');
    const order: string[] = [];
    const logIn = Promise.withResolvers<void>();
    purchases.logIn.mockImplementation(async () => {
      await logIn.promise;
      order.push('logIn');
    });
    purchases.purchase.mockImplementation(async () => {
      order.push('purchase');
      return { type: 'package-not-found' };
    });
    session.logOut();
    session.logIn('user-b');

    // When
    const purchasing = service.purchase('$rc_annual');
    logIn.resolve();
    await purchasing;

    // Then
    expect(order).toEqual(['logIn', 'purchase']);
  });

  it.each([
    ['결제', (service: SubscriptionService) => service.purchase('$rc_annual')],
    ['복원', (service: SubscriptionService) => service.restorePurchases()],
  ])(
    '계정을 바꾼 결제 SDK 로그인이 실패했으면 앞 계정에 귀속되지 않게 막고 스토어 연결 오류로 알린다(%s)',
    async (_name, run) => {
      // Given
      const { service, session, purchases } = createConfiguredService();
      await session.logIn('user-a');
      purchases.logIn.mockRejectedValueOnce(new Error('network'));
      session.logOut();
      await session.logIn('user-b');

      // When
      const result = await run(service);

      // Then
      expect(result).toMatchObject({
        ok: false,
        error: { code: SUBSCRIPTION_ERROR_CODE.STORE_PROBLEM },
      });
      expect(purchases.purchase).not.toHaveBeenCalled();
      expect(purchases.restore).not.toHaveBeenCalled();
    },
  );

  it('보상 기간만 있는 계정은 복원해도 복원할 구매가 없다', async () => {
    // Given
    const { service, session, purchases } = createConfiguredService();
    await session.logIn('user-1');
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
