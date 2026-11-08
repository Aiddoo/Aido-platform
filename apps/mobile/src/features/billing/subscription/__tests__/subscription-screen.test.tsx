import '@src/shared/i18n/init';
import type { AccessTier } from '@aido/api';
import { ok } from '@src/core/errors/result';
import { PurchasesGatewayError, type PurchaseOffering } from '@src/core/ports/purchases-gateway';
import { PREMIUM_ME_EXAMPLES } from '@src/features/identity/user/__tests__/premium-access.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { type CurrentUserResponse } from '@src/features/identity/user/schemas/user-response.schema';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createPurchasesGatewayStub,
  createTestDi,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { onlineManager } from '@tanstack/react-query';
import { screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import SubscriptionRoute from '../../../../../app/(app)/(mypage-menu)/settings/subscription';
import { ENTITLEMENT_QUERY_KEYS } from '../constants/entitlement-query-keys';
import { createEntitlementSnapshot, createEntitlementSnapshotDto } from './entitlement.fixtures';

const HOUR_MS = 60 * 60 * 1000;

function createPackage(
  packageType: 'ANNUAL' | 'MONTHLY',
  price: number,
): PurchaseOffering['packages'][number] {
  return {
    identifier: packageType.toLowerCase(),
    packageType,
    product: {
      priceString: `₩${price.toLocaleString('en-US')}`,
      price,
      currencyCode: 'KRW',
      title: packageType,
      description: null,
    },
  };
}

const MONTHLY_AND_ANNUAL: PurchaseOffering = {
  identifier: 'default',
  packages: [createPackage('MONTHLY', 3_900), createPackage('ANNUAL', 29_900)],
};

interface ScreenState {
  tier: AccessTier;
  me: CurrentUserResponse;
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

function createEndingRewardState(): ScreenState {
  const endsAt = new Date(Date.now() + 2 * HOUR_MS).toISOString();
  return {
    tier: 'PREMIUM',
    me: createCurrentUserDto({
      subscriptionStatus: 'ACTIVE',
      isPremium: true,
      premiumSource: 'GRANT',
      premiumEndsAt: endsAt,
      premiumPeriodEndsAt: endsAt,
      willRenew: false,
      bankedPremiumDays: 0,
      premiumGrantEndedAt: null,
    }),
  };
}

// 요금제를 받는 중에 머물러 페이월 자리(요금제 요청)만 확인하는 것이 기본이다
async function renderSubscriptionScreen(
  state: ScreenState | null,
  getOffering: () => Promise<PurchaseOffering | null> = () => new Promise(() => {}),
) {
  const purchases = createPurchasesGatewayStub();
  purchases.getOffering.mockImplementation(getOffering);
  const analytics = createAnalyticsStub();
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createEntitlementSnapshotDto({ tier: state?.tier })));
  const di = createTestDi({
    httpClient,
    analytics,
    purchasesGateway: purchases,
  });
  di.purchasesSession.configure();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  if (state != null) {
    queryClient.setQueryData(USER_QUERY_KEYS.me(), toUser(state.me));
    queryClient.setQueryData(
      ENTITLEMENT_QUERY_KEYS.snapshot(),
      createEntitlementSnapshot({ tier: state.tier }),
    );
  }

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <SubscriptionRoute />
      </OverlayProvider>
    </LocalDateProvider>,
    { di, queryClient },
  );

  return { purchases, analytics };
}

describe('구독 화면', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
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
    ['결제', PAID, 'subscription-receipt-paid'],
    ['초대 보상', REWARD, 'subscription-receipt-reward'],
    ['관리자', ADMIN, 'subscription-receipt-admin'],
  ] as const)(
    '%s 사용자는 구매를 권하지 않고 영수증을 보여 준다',
    async (_case, state, receiptTestId) => {
      // Given
      const screenState = state;

      // When
      const { purchases } = await renderSubscriptionScreen(screenState);

      // Then
      expect(await screen.findByTestId(receiptTestId)).toBeTruthy();
      expect(purchases.getOffering).not.toHaveBeenCalled();
      expect(screen.queryByTestId('subscription-paywall')).toBeNull();
    },
  );

  it('관리자 영수증은 관리자 계정 행만 보이고 구독 버튼이 없다', async () => {
    // Given
    const state = ADMIN;

    // When
    await renderSubscriptionScreen(state);

    // Then
    expect(await screen.findByText('관리자 계정')).toBeTruthy();
    expect(screen.getByText('관리자')).toBeTruthy();
    expect(screen.queryByText('구독하고 계속 쓰기')).toBeNull();
    expect(screen.queryByText('구독 관리 (스토어 설정)')).toBeNull();
  });

  it('곧 끝나는 초대 보상은 끝남 안내와 구독 버튼을 보여 준다', async () => {
    // Given
    const state = createEndingRewardState();

    // When
    await renderSubscriptionScreen(state);

    // Then
    expect(await screen.findByTestId('subscription-ending-notice')).toBeTruthy();
    expect(screen.getByText('구독하고 계속 쓰기')).toBeTruthy();
  });

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
          },
        },
      ],
    };

    // When
    const { analytics } = await renderSubscriptionScreen(FREE, () => Promise.resolve(offering));

    // Then
    expect(await screen.findByText('₩68,000')).toBeTruthy();
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
      expect(screen.getByTestId('subscription-purchase').props.accessibilityState.disabled).toBe(
        true,
      );
      expect(analytics.trackEvent).not.toHaveBeenCalledWith('paywall_viewed', expect.anything());
    },
  );

  it('오프라인에서 요금제를 못 받으면 요금제 자리에서 연결되면 보여 준다고 알린다', async () => {
    // Given
    onlineManager.setOnline(false);

    // When
    await renderSubscriptionScreen(FREE);

    // Then
    expect(await screen.findByTestId('subscription-offline')).toBeTruthy();
    expect(screen.getByTestId('subscription-paywall')).toBeTruthy();
  });

  it('오프라인에서 내 정보가 없으면 영수증 자리에서 연결되면 보여 준다고 알린다', async () => {
    // Given
    onlineManager.setOnline(false);

    // When
    await renderSubscriptionScreen(null);

    // Then
    expect(await screen.findByTestId('subscription-offline')).toBeTruthy();
  });

  it('막혀서 들어오면 그 기능을 요금제보다 먼저, 연간 요금제를 월간보다 먼저 보여 준다', async () => {
    // Given
    jest.mocked(useLocalSearchParams).mockReturnValue({ feature: 'AI_PARSE' });

    // When
    const { analytics } = await renderSubscriptionScreen(FREE, () =>
      Promise.resolve(MONTHLY_AND_ANNUAL),
    );

    // Then
    expect(await screen.findByText('₩29,900')).toBeTruthy();
    const blockedFeature = screen.getByTestId('paywall-blocked-feature');
    expect(within(blockedFeature).getByText('AI 할 일 만들기 넉넉하게')).toBeTruthy();
    expect(
      screen
        .getAllByText(/^(AI 할 일 만들기 넉넉하게|연간 구독|월간 구독)$/)
        .map((element) => element.props.children),
    ).toEqual(['AI 할 일 만들기 넉넉하게', '연간 구독', '월간 구독', 'AI 할 일 만들기 넉넉하게']);
    expect(screen.getByRole('button', { name: '연간으로 시작하기' })).toBeTruthy();
    expect(analytics.trackEvent).toHaveBeenCalledWith('paywall_viewed', {
      view: 'status',
      feature: 'ai_parse',
    });
  });

  it('모르는 기능으로 들어오면 막힌 기능 없이 페이월을 보여 준다', async () => {
    // Given
    jest.mocked(useLocalSearchParams).mockReturnValue({ feature: 'UNKNOWN' });

    // When
    const { analytics } = await renderSubscriptionScreen(FREE, () =>
      Promise.resolve(MONTHLY_AND_ANNUAL),
    );

    // Then
    expect(await screen.findByText('₩29,900')).toBeTruthy();
    expect(screen.queryByTestId('paywall-blocked-feature')).toBeNull();
    expect(analytics.trackEvent).toHaveBeenCalledWith('paywall_viewed', { view: 'status' });
  });

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
    expect(selectedEvents).toEqual([['paywall_plan_selected', { plan_type: 'monthly' }]]);
    expect(
      analytics.trackEvent.mock.calls.filter(([eventName]) => eventName === 'paywall_viewed'),
    ).toHaveLength(1);
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
      }),
    );
    const purchaseEvents = analytics.trackEvent.mock.calls
      .map(([eventName]) => eventName)
      .filter(
        (eventName) => eventName.startsWith('purchase') || eventName.startsWith('subscription'),
      );
    expect(purchaseEvents).toEqual(['purchase_cancelled']);
  });
});
