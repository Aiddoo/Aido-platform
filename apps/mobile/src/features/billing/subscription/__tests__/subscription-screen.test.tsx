import '@src/shared/i18n/init';
import type { AccessTier } from '@aido/api';
import { ok } from '@src/core/errors/result';
import { PurchasesGatewayError, type PurchaseOffering } from '@src/core/ports/purchases-gateway';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { toPreference } from '@src/features/identity/preference/apis/preference.mapper';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import { PREMIUM_ME_EXAMPLES } from '@src/features/identity/user/__tests__/premium-access.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { type User } from '@src/features/identity/user/domains/user.model';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { type CurrentUserResponse } from '@src/features/identity/user/schemas/user-response.schema';
import { i18n } from '@src/shared/i18n';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createPurchasesGatewayStub,
  createRouteParamsFake,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import SubscriptionRoute from '../../../../../app/(app)/(tabs)/(mypage)/settings/subscription';
import { ENTITLEMENT_QUERY_KEYS } from '../queries/entitlement-query-keys';
import { createEntitlementSnapshot, createEntitlementSnapshotDto } from './entitlement.fixtures';

type StorePackage = PurchaseOffering['packages'][number];

function createPackage(
  packageType: 'ANNUAL' | 'MONTHLY',
  price: number,
  freeTrial: StorePackage['product']['freeTrial'] = null,
): StorePackage {
  return {
    identifier: packageType.toLowerCase(),
    packageType,
    product: {
      priceString: `₩${price.toLocaleString('en-US')}`,
      price,
      currencyCode: 'KRW',
      title: packageType,
      description: null,
      freeTrial,
    },
  };
}

const MONTHLY_AND_ANNUAL: PurchaseOffering = {
  identifier: 'default',
  packages: [createPackage('MONTHLY', 3_900), createPackage('ANNUAL', 29_900)],
};

function createAnnualTrialOffering(freeTrial: StorePackage['product']['freeTrial']) {
  return {
    identifier: 'default',
    packages: [createPackage('MONTHLY', 3_900), createPackage('ANNUAL', 29_900, freeTrial)],
  } satisfies PurchaseOffering;
}

/** 연간에만 2주 무료 체험이 있고 이 사용자는 자격이 있다 */
const ANNUAL_WITH_FREE_TRIAL = createAnnualTrialOffering({
  periodUnit: 'WEEK',
  periodNumberOfUnits: 2,
});

interface ScreenState {
  tier: AccessTier;
  me: CurrentUserResponse;
  /** 서버 응답 대신 영속 캐시에서 복원한 내 정보 */
  restoredMe?: User;
}

const FREE: ScreenState = {
  tier: 'FREE',
  me: createCurrentUserDto({ subscriptionStatus: 'FREE' }),
};
const PAID: ScreenState = {
  tier: 'PREMIUM',
  me: PREMIUM_ME_EXAMPLES.rewardDuringRenewingSubscription,
};
const REWARD: ScreenState = { tier: 'PREMIUM', me: PREMIUM_ME_EXAMPLES.newRewardAfterEnded };
const ADMIN: ScreenState = {
  tier: 'ADMIN',
  me: createCurrentUserDto({ role: 'ADMIN', subscriptionStatus: 'FREE' }),
};

// 요금제를 받는 중에 머물러 페이월 자리(요금제 요청)만 확인하는 것이 기본이다
async function renderSubscriptionScreen(
  state: ScreenState | null,
  getOffering: () => Promise<PurchaseOffering | null> = () => new Promise(() => {}),
  routeParams: Record<string, string> = {},
) {
  createRouteParamsFake(routeParams);
  const purchases = createPurchasesGatewayStub();
  purchases.getOffering.mockImplementation(getOffering);
  const analytics = createAnalyticsStub();
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createEntitlementSnapshotDto({ tier: state?.tier })));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), toPreference(createPreferenceDto()));
  if (state != null) {
    queryClient.setQueryData(USER_QUERY_KEYS.me(), state.restoredMe ?? toUser(state.me));
    queryClient.setQueryData(
      ENTITLEMENT_QUERY_KEYS.snapshot(),
      createEntitlementSnapshot({ tier: state.tier }),
    );
  }
  const di = createTestDi({ ports: { httpClient, analytics, purchases, queryClient } });
  di.purchasesSession.configure();
  // 결제 Provider처럼 결제 SDK에 로그인해 둔다. 로그인 전 결제는 막힌다
  await di.purchasesSession.logIn('user-1');

  await renderScreen(
    <LocalDateProvider>
      <OverlayProvider>
        <SubscriptionRoute />
      </OverlayProvider>
    </LocalDateProvider>,
    { di },
  );

  return { purchases, analytics };
}

describe('구독 화면', () => {
  afterEach(async () => {
    onlineManager.setOnline(true);
    await i18n.changeLanguage('ko');
  });

  it('무료 사용자에게는 요금제를 받아 페이월을 보여 준다', async () => {
    // Given
    const state = FREE;

    // When
    const { purchases } = await renderSubscriptionScreen(state);

    // Then
    expect(purchases.getOffering).toHaveBeenCalled();
    expect(screen.queryByTestId(/^subscription-receipt-/)).toBeNull();
  });

  it.each([
    // 결제 영수증은 요금제 줄에 스토어 가격을 붙이려고 요금제만 읽는다
    ['결제', PAID, 'subscription-receipt-paid', true],
    ['초대 보상', REWARD, 'subscription-receipt-reward', false],
    ['관리자', ADMIN, 'subscription-receipt-admin', false],
  ] as const)(
    '%s 사용자는 구매를 권하지 않고 영수증을 보여 준다',
    async (_case, state, receiptTestId, readsPlanPrice) => {
      // Given
      const screenState = state;

      // When
      const { purchases } = await renderSubscriptionScreen(screenState);

      // Then
      expect(await screen.findByTestId(receiptTestId)).toBeTruthy();
      expect(purchases.getOffering).toHaveBeenCalledTimes(readsPlanPrice ? 1 : 0);
      expect(screen.queryByTestId('subscription-paywall')).toBeNull();
      expect(screen.queryByTestId('subscription-purchase')).toBeNull();
    },
  );

  it('요금제를 받으면 고를 수 있게 보여 주고 페이월을 본 것으로 센다', async () => {
    // Given
    const offering: PurchaseOffering = {
      identifier: 'default',
      packages: [
        {
          identifier: 'annual',
          packageType: 'ANNUAL',
          product: {
            priceString: '₩68,000',
            price: 68_000,
            currencyCode: 'KRW',
            title: '연간',
            description: null,
            freeTrial: null,
          },
        },
      ],
    };

    // When
    const { analytics } = await renderSubscriptionScreen(FREE, () => Promise.resolve(offering));

    // Then
    const amountDueToday = await screen.findByTestId('subscription-amount-due-today');
    expect(within(amountDueToday).getByText('₩68,000')).toBeTruthy();
    expect(
      screen.getByTestId('subscription-purchase').props.accessibilityState.disabled,
    ).toBeFalsy();
    expect(analytics.trackEvent).toHaveBeenCalledWith('paywall_viewed', expect.anything());
  });

  it.each([
    ['스토어를 쓸 수 없으면', new PurchasesGatewayError('store-setup', null, 'setup')],
    ['요금제를 받지 못하면', new PurchasesGatewayError('other', null, 'other')],
  ])(
    '%s 혜택은 그대로 두고 요금제 자리에서 안내하며 페이월을 세지 않는다',
    async (_case, error) => {
      // Given
      const state = FREE;

      // When
      const { analytics } = await renderSubscriptionScreen(state, () => Promise.reject(error));

      // Then
      expect(await screen.findByTestId('subscription-load-failure')).toBeTruthy();
      expect(screen.getByTestId('subscription-paywall')).toBeTruthy();
      expect(screen.queryByTestId('subscription-amount-due-today')).toBeNull();
      expect(screen.queryByTestId('subscription-trial-timeline')).toBeNull();
      expect(screen.queryByText('체험 끝나기 전 알림')).toBeNull();
      expect(screen.getByTestId('subscription-purchase').props.accessibilityState.disabled).toBe(
        true,
      );
      expect(analytics.trackEvent).not.toHaveBeenCalledWith('paywall_viewed', expect.anything());
    },
  );

  it('월간을 고르면 버튼이 월간으로 바뀌고 고른 요금제를 한 번만 센다', async () => {
    // Given
    const user = userEvent.setup();
    const { analytics } = await renderSubscriptionScreen(FREE, () =>
      Promise.resolve(MONTHLY_AND_ANNUAL),
    );
    await screen.findByText('₩3,900');

    // When
    await user.press(screen.getByText('월간 구독'));
    await user.press(screen.getByText('월간 구독'));

    // Then
    expect(await screen.findByRole('button', { name: '월간으로 시작하기' })).toBeTruthy();
    const selectedEvents = analytics.trackEvent.mock.calls.filter(
      ([eventName]) => eventName === 'paywall_plan_selected',
    );
    expect(selectedEvents).toEqual([
      ['paywall_plan_selected', { plan_type: 'monthly', is_trial: false }],
    ]);
    expect(
      analytics.trackEvent.mock.calls.filter(([eventName]) => eventName === 'paywall_viewed'),
    ).toHaveLength(1);
  });

  it('링크가 월간 요금제를 미리 골랐으면 월간이 골라진 채로 열린다', async () => {
    // Given
    const routeParams = { plan: 'monthly' };

    // When
    await renderSubscriptionScreen(FREE, () => Promise.resolve(MONTHLY_AND_ANNUAL), routeParams);

    // Then
    expect(await screen.findByRole('button', { name: '월간으로 시작하기' })).toBeTruthy();
    const amountDueToday = screen.getByTestId('subscription-amount-due-today');
    expect(within(amountDueToday).getByText('₩3,900')).toBeTruthy();
  });

  it('결제 창에서 취소하면 고른 요금제로 취소를 한 번만 센다', async () => {
    // Given
    const user = userEvent.setup();
    const { purchases, analytics } = await renderSubscriptionScreen(FREE, () =>
      Promise.resolve(MONTHLY_AND_ANNUAL),
    );
    purchases.purchase.mockRejectedValue(new PurchasesGatewayError('cancelled', null, 'cancelled'));

    // When
    await user.press(await screen.findByRole('button', { name: '연간으로 시작하기' }));

    // Then
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith('purchase_cancelled', {
        plan_type: 'annual',
        is_trial: false,
      }),
    );
    const purchaseEvents = analytics.trackEvent.mock.calls
      .map(([eventName]) => eventName)
      .filter(
        (eventName) => eventName.startsWith('purchase') || eventName.startsWith('subscription'),
      );
    expect(purchaseEvents).toEqual(['purchase_cancelled']);
  });
  it('결제 버튼을 같은 프레임에 두 번 눌러도 결제 창은 한 번만 연다', async () => {
    // Given
    const { purchases } = await renderSubscriptionScreen(FREE, () =>
      Promise.resolve(MONTHLY_AND_ANNUAL),
    );
    purchases.purchase.mockReturnValue(new Promise(() => {}));
    const button = await screen.findByRole('button', { name: '연간으로 시작하기' });

    // When
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });

    // Then
    await waitFor(() => expect(purchases.purchase).toHaveBeenCalled());
    expect(purchases.purchase).toHaveBeenCalledTimes(1);
  });

  it('스토어 연결이 끊겨 결제를 마치지 못하면 문의할 수 있는 다이얼로그를 띄운다', async () => {
    // Given
    const user = userEvent.setup();
    const { purchases } = await renderSubscriptionScreen(FREE, () =>
      Promise.resolve(MONTHLY_AND_ANNUAL),
    );
    purchases.purchase.mockRejectedValue(new PurchasesGatewayError('network', null, 'offline'));

    // When
    await user.press(await screen.findByRole('button', { name: '연간으로 시작하기' }));

    // Then
    expect(await screen.findByText('결제를 마치지 못했어요')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: i18n.t('subscription:failure.contactSupport') }),
    ).toBeTruthy();
  });

  describe('결제 뒤 시작 화면', () => {
    it('체험으로 결제하면 서버 반영이 늦어도 방금 산 요금제로 체험 일정을 보여 주고 반영이 늦는다고 알린다', async () => {
      // Given
      const user = userEvent.setup();
      const { purchases, analytics } = await renderSubscriptionScreen(FREE, () =>
        Promise.resolve(ANNUAL_WITH_FREE_TRIAL),
      );
      // 스토어 결제는 끝났지만 권한이 아직 안 보여 서버 반영을 기다리지 못한 경우
      purchases.purchase.mockResolvedValue({
        type: 'purchased',
        status: { activeEntitlements: [], managementUrl: null },
      });

      // When
      await user.press(await screen.findByRole('button', { name: '2주 무료로 시작하기' }));

      // Then
      const welcome = await screen.findByTestId('subscription-welcome');
      expect(within(welcome).getByText('프리미엄을 시작했어요')).toBeTruthy();
      expect(within(welcome).getByText(/전까지 모든 기능을 무료로 써요$/)).toBeTruthy();
      expect(within(welcome).getByText('연 ₩29,900')).toBeTruthy();
      expect(within(welcome).getByText(/ · 연 ₩29,900$/)).toBeTruthy();
      expect(
        await screen.findAllByText('결제가 반영되기까지 잠시 걸릴 수 있어요'),
      ).not.toHaveLength(0);
      expect(analytics.trackEvent).toHaveBeenCalledWith('checkout_step_viewed', {
        step: 'welcome',
      });
    });

    it('체험 없이 월간으로 결제하면 체험 일정 없이 요금제만 보여 준다', async () => {
      // Given
      const user = userEvent.setup();
      const { purchases } = await renderSubscriptionScreen(FREE, () =>
        Promise.resolve(ANNUAL_WITH_FREE_TRIAL),
      );
      purchases.purchase.mockResolvedValue({
        type: 'purchased',
        status: { activeEntitlements: [], managementUrl: null },
      });
      await user.press(await screen.findByText('월간 구독'));

      // When
      await user.press(await screen.findByRole('button', { name: '월간으로 시작하기' }));

      // Then
      const welcome = await screen.findByTestId('subscription-welcome');
      expect(within(welcome).getByText('모든 기능을 넉넉하게 써 보세요')).toBeTruthy();
      expect(within(welcome).getByText('월 ₩3,900')).toBeTruthy();
      expect(within(welcome).queryByText('첫 결제')).toBeNull();
      expect(
        await screen.findAllByText('결제가 반영되기까지 잠시 걸릴 수 있어요'),
      ).not.toHaveLength(0);
    });
  });

  describe('결제 뒤 시작 화면의 완료', () => {
    it('완료를 연달아 눌러도 한 번만 돌아간다', async () => {
      // Given
      const user = userEvent.setup();
      const { purchases } = await renderSubscriptionScreen(FREE, () =>
        Promise.resolve(ANNUAL_WITH_FREE_TRIAL),
      );
      purchases.purchase.mockResolvedValue({
        type: 'purchased',
        status: { activeEntitlements: [], managementUrl: null },
      });
      await user.press(await screen.findByRole('button', { name: '2주 무료로 시작하기' }));
      const done = await screen.findByTestId('subscription-welcome-done');

      // When
      await fireEvent.press(done);
      await fireEvent.press(done);

      // Then
      expect(router.back).toHaveBeenCalledTimes(1);
    });
  });

  describe('무료 체험', () => {
    it('체험 자격이 있는 연간을 고르면 칩·일정·체험 버튼과 그 아래 결제 고지를 보여 준다', async () => {
      // When
      const { analytics } = await renderSubscriptionScreen(FREE, () =>
        Promise.resolve(ANNUAL_WITH_FREE_TRIAL),
      );

      // Then
      expect(await screen.findByTestId('subscription-trial-timeline')).toBeTruthy();
      expect(screen.getByTestId('subscription-plan-free-trial')).toBeTruthy();
      expect(screen.getByText('2주 무료')).toBeTruthy();
      // 가장 큰 가격은 체험 뒤 실제 청구액이고, 오늘은 결제되지 않는다
      expect(screen.getByText('₩29,900')).toBeTruthy();
      const amountDueToday = screen.getByTestId('subscription-amount-due-today');
      expect(within(amountDueToday).getByText('₩0')).toBeTruthy();
      expect(screen.getByRole('button', { name: '2주 무료로 시작하기' })).toBeTruthy();
      expect(screen.getByTestId('subscription-trial-disclosure').props.children).toMatch(
        /부터 연\u00A0₩29,900 정기결제 · 언제든 해지할 수 있어요$/,
      );
      const timeline = screen.getByTestId('subscription-trial-timeline');
      expect(within(timeline).getByText('체험 시작')).toBeTruthy();
      expect(within(timeline).getByText('3일 전 알림')).toBeTruthy();
      expect(within(timeline).getByText('첫 결제 연 ₩29,900')).toBeTruthy();
      expect(await within(timeline).findByText('체험 끝나기 전 알림')).toBeTruthy();
      expect(analytics.trackEvent).toHaveBeenCalledWith('trial_timeline_viewed', {
        plan_type: 'annual',
      });
    });

    it('체험으로 결제 창에서 취소하면 체험이었다는 것까지 센다', async () => {
      // Given
      const user = userEvent.setup();
      const { purchases, analytics } = await renderSubscriptionScreen(FREE, () =>
        Promise.resolve(ANNUAL_WITH_FREE_TRIAL),
      );
      purchases.purchase.mockRejectedValue(
        new PurchasesGatewayError('cancelled', null, 'cancelled'),
      );

      // When
      await user.press(await screen.findByRole('button', { name: '2주 무료로 시작하기' }));

      // Then
      await waitFor(() =>
        expect(analytics.trackEvent).toHaveBeenCalledWith('purchase_cancelled', {
          plan_type: 'annual',
          is_trial: true,
        }),
      );
    });
  });
});
