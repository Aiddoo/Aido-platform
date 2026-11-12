import {
  createAnalyticsStub,
  createAppLoggerStub,
  createPurchasesGatewayStub,
} from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import { PURCHASES_SDK_CALL_TIMEOUT_MS } from '../constants/subscription.constants';
import { PurchasesSession } from './purchases.session';

setupFakeTimersPerTest();

const flushPromises = () => jest.advanceTimersByTimeAsync(0);

function createManager({
  purchases = createPurchasesGatewayStub(),
  logger = createAppLoggerStub(),
  analytics = createAnalyticsStub(),
} = {}) {
  const manager = new PurchasesSession({
    purchases,
    logger,
    analytics,
    subscriberAttributes: { appVersion: '1.14.0', deviceModel: 'iPhone 17' },
  });
  return { manager, purchases, logger, analytics };
}

describe('RevenueCat 구독자 속성', () => {
  it('로그인하면 운영 알림에 쓸 앱 버전과 기기 모델을 설정한다', async () => {
    // Given
    const { manager, purchases } = createManager();
    manager.configure();
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

  it('속성 설정이 실패해도 로그인은 이어지고 경고만 남긴다', async () => {
    // Given
    const { manager, purchases, logger } = createManager();
    purchases.setAttributes.mockRejectedValue(new Error('network'));
    manager.configure();
    await flushPromises();

    // When
    await manager.logIn('user-1');

    // Then
    expect(logger.warn).toHaveBeenCalledWith(
      SUBSCRIPTION_LOG_EVENT.PURCHASES_SUBSCRIBER_ATTRIBUTES_SYNC_FAILED,
      { error: 'network' },
    );
  });
});

describe('RevenueCat Firebase 앱 인스턴스 ID 연동', () => {
  it('SDK 초기화 후 Firebase 앱 인스턴스 ID를 RevenueCat에 설정한다', async () => {
    // Given
    const analytics = createAnalyticsStub();
    analytics.getAnalyticsId.mockResolvedValue('instance-1');
    const { manager, purchases } = createManager({ analytics });

    // When
    manager.configure();
    await flushPromises();

    // Then
    expect(purchases.setAnalyticsId).toHaveBeenCalledWith('instance-1');
  });

  it('로그인 후 바뀐 사용자에게도 앱 인스턴스 ID를 다시 설정한다', async () => {
    // Given
    const analytics = createAnalyticsStub();
    analytics.getAnalyticsId.mockResolvedValue('instance-1');
    const { manager, purchases } = createManager({ analytics });
    manager.configure();
    await flushPromises();
    purchases.setAnalyticsId.mockClear();

    // When
    await manager.logIn('user-1');

    // Then
    expect(purchases.setAnalyticsId).toHaveBeenCalledWith('instance-1');
  });

  it('앱 인스턴스 ID가 없으면 RevenueCat 속성을 건드리지 않는다', async () => {
    // Given
    const { manager, purchases } = createManager();

    // When
    manager.configure();
    await flushPromises();

    // Then
    expect(purchases.setAnalyticsId).not.toHaveBeenCalled();
  });

  it('앱 인스턴스 ID 설정이 실패해도 예외 없이 경고만 남긴다', async () => {
    // Given
    const analytics = createAnalyticsStub();
    analytics.getAnalyticsId.mockRejectedValue(new Error('analytics disabled'));
    const { manager, purchases, logger } = createManager({ analytics });
    manager.configure();
    await flushPromises();

    // When
    await manager.logIn('user-1');

    // Then
    expect(logger.warn).toHaveBeenCalledWith(
      SUBSCRIPTION_LOG_EVENT.PURCHASES_ANALYTICS_ID_SYNC_FAILED,
      { error: 'analytics disabled' },
    );
    expect(purchases.setAnalyticsId).not.toHaveBeenCalled();
  });
});

describe('PurchasesSession 로그인·로그아웃 순서', () => {
  it('로그인이 끝나기 전에 로그아웃하면 로그인이 끝난 뒤 로그아웃해 마지막 요청대로 끝난다', async () => {
    // Given
    const { manager, purchases } = createManager();
    manager.configure();
    await flushPromises();
    const order: string[] = [];
    const logIn = Promise.withResolvers<void>();
    const finishLogIn = () => {
      order.push('logIn:end');
      logIn.resolve();
    };
    purchases.logIn.mockImplementation(() => {
      order.push('logIn:start');
      return logIn.promise;
    });
    purchases.logOut.mockImplementation(async () => {
      order.push('logOut');
    });
    purchases.setAttributes.mockClear();

    // When
    const loggingIn = manager.logIn('user-1');
    await flushPromises();
    const loggingOut = manager.logOut();
    await flushPromises();
    finishLogIn();
    await Promise.all([loggingIn, loggingOut]);

    // Then
    expect(order).toEqual(['logIn:start', 'logIn:end', 'logOut']);
    expect(purchases.setAttributes).not.toHaveBeenCalled();
  });

  it('아직 시작하지 않은 요청은 뒤에 온 요청이 있으면 건너뛰고 마지막 요청만 보낸다', async () => {
    // Given
    const { manager, purchases } = createManager();
    manager.configure();
    await flushPromises();

    // When
    await Promise.all([manager.logOut(), manager.logIn('user-1'), manager.logOut()]);

    // Then
    expect(purchases.logIn).not.toHaveBeenCalled();
    expect(purchases.logOut).toHaveBeenCalledTimes(1);
  });

  it('결제 SDK 로그인이 멈춰도 정해 둔 시간 뒤 끊고 뒤의 로그아웃을 보낸다', async () => {
    // Given
    const { manager, purchases, logger } = createManager();
    manager.configure();
    await flushPromises();
    purchases.logIn.mockImplementation(() => new Promise(() => undefined));

    // When
    const loggingIn = manager.logIn('user-1');
    await flushPromises();
    const loggingOut = manager.logOut();
    await jest.advanceTimersByTimeAsync(PURCHASES_SDK_CALL_TIMEOUT_MS);
    await Promise.all([loggingIn, loggingOut]);

    // Then
    expect(purchases.logOut).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      SUBSCRIPTION_LOG_EVENT.PURCHASES_LOGIN_FAILED,
      expect.objectContaining({ error: expect.any(String) }),
    );
  });
});

describe('PurchasesSession 결제 계정', () => {
  it('다른 계정 로그인이 끝나기 전에 물으면 끝날 때까지 기다려 그 계정을 돌려준다', async () => {
    // Given
    const { manager, purchases } = createManager();
    manager.configure();
    await manager.logIn('user-a');
    const logIn = Promise.withResolvers<void>();
    purchases.logIn.mockImplementation(() => logIn.promise);
    manager.logOut();
    manager.logIn('user-b');
    let signedInUser: string | null | undefined;

    // When
    const waiting = manager.waitForSignedInUser().then((userId) => {
      signedInUser = userId;
    });
    await flushPromises();

    // Then
    expect(signedInUser).toBeUndefined();

    // When
    logIn.resolve();
    await waiting;

    // Then
    expect(signedInUser).toBe('user-b');
  });

  it.each([
    ['실패하면', () => Promise.reject(new Error('network'))],
    ['시간 초과면', () => new Promise<void>(() => undefined)],
  ])(
    '계정을 바꾼 로그인이 %s 앞 계정에 귀속되지 않게 null을 돌려주고 그 계정으로 다시 로그인한다',
    async (_name, failLogIn) => {
      // Given
      const { manager, purchases } = createManager();
      manager.configure();
      await manager.logIn('user-a');
      purchases.logIn.mockImplementationOnce(failLogIn);
      manager.logOut();
      const loggingIn = manager.logIn('user-b');
      await jest.advanceTimersByTimeAsync(PURCHASES_SDK_CALL_TIMEOUT_MS);
      await loggingIn;

      // When
      const signedInUser = await manager.waitForSignedInUser();
      await flushPromises();

      // Then
      expect(signedInUser).toBeNull();
      expect(purchases.logIn).toHaveBeenLastCalledWith('user-b');
      await expect(manager.waitForSignedInUser()).resolves.toBe('user-b');
    },
  );

  it('로그아웃했으면 결제할 계정이 없다', async () => {
    // Given
    const { manager } = createManager();
    manager.configure();
    await manager.logIn('user-a');
    await manager.logOut();

    // When
    const signedInUser = await manager.waitForSignedInUser();

    // Then
    expect(signedInUser).toBeNull();
  });
});
