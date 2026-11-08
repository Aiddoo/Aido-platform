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
import { screen } from '@testing-library/react-native';

import SubscriptionRoute from '../../../../../app/(app)/(mypage-menu)/settings/subscription';
import { ENTITLEMENT_QUERY_KEYS } from '../constants/entitlement-query-keys';
import { createEntitlementSnapshot, createEntitlementSnapshotDto } from './entitlement.fixtures';

const HOUR_MS = 60 * 60 * 1000;

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
});
