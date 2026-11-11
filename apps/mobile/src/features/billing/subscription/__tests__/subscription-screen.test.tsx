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
import { type User, userSchema } from '@src/features/identity/user/domains/user.model';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { type CurrentUserResponse } from '@src/features/identity/user/schemas/user-response.schema';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createPurchasesGatewayStub,
  createRouteParamsFake,
  createTestDi,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { i18n } from '@src/shared/i18n';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { onlineManager } from '@tanstack/react-query';
import { screen, userEvent, waitFor, within } from '@testing-library/react-native';

import SubscriptionRoute from '../../../../../app/(app)/(tabs)/(mypage)/settings/subscription';
import { ENTITLEMENT_QUERY_KEYS } from '../queries/entitlement-query-keys';
import { createEntitlementSnapshot, createEntitlementSnapshotDto } from './entitlement.fixtures';

const HOUR_MS = 60 * 60 * 1000;

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

const DAY_MS = 24 * HOUR_MS;

/** 체험 끝(첫 결제일)이 지금부터 정확히 N일 뒤라 기기 시간대에서도 달력 N일 뒤다 */
function createTrialState({ daysLeft, willRenew }: { daysLeft: number; willRenew: boolean }) {
  const periodEndsAt = new Date(Date.now() + daysLeft * DAY_MS).toISOString();
  return {
    tier: 'PREMIUM',
    me: createCurrentUserDto({
      subscriptionStatus: 'ACTIVE',
      isPremium: true,
      premiumSource: 'STORE',
      premiumEndsAt: periodEndsAt,
      premiumPeriodEndsAt: periodEndsAt,
      willRenew,
      bankedPremiumDays: 0,
      premiumGrantEndedAt: null,
      premiumIsTrial: true,
      premiumPlanType: 'ANNUAL',
    }),
  } satisfies ScreenState;
}

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
  const di = createTestDi({
    httpClient,
    analytics,
    purchasesGateway: purchases,
  });
  di.purchasesSession.configure();
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

  it('저장해 둔 옛 내 정보에 요금제가 없어도 영수증은 요금제 없이 구독으로 보인다', async () => {
    // Given
    // 앱 버전이 같은 OTA 뒤에는 요금제 필드가 생기기 전의 /me가 영속 캐시에서 복원된다
    const { planType: _planType, ...restoredAccess } = toUser(PAID.me).premiumAccess;
    const restoredMe = userSchema.parse({ ...toUser(PAID.me), premiumAccess: restoredAccess });

    // When
    await renderSubscriptionScreen({ ...PAID, restoredMe });

    // Then
    const planRow = await screen.findByTestId('subscription-receipt-row-plan');
    expect(within(planRow).getByText('구독')).toBeTruthy();
  });

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

  it('오프라인에서 요금제를 못 받으면 요금제 자리에서 연결되면 보여 준다고 알린다', async () => {
    // Given
    onlineManager.setOnline(false);

    // When
    await renderSubscriptionScreen(FREE);

    // Then
    expect(await screen.findByTestId('subscription-offline')).toBeTruthy();
    expect(screen.getByTestId('subscription-paywall')).toBeTruthy();
    expect(screen.queryByTestId('subscription-amount-due-today')).toBeNull();
    expect(screen.queryByTestId('subscription-trial-timeline')).toBeNull();
    expect(screen.getByTestId('subscription-purchase').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('오프라인에서 내 정보가 없으면 영수증 자리에서 연결되면 보여 준다고 알린다', async () => {
    // Given
    onlineManager.setOnline(false);

    // When
    await renderSubscriptionScreen(null);

    // Then
    expect(await screen.findByTestId('subscription-offline')).toBeTruthy();
  });

  it.each([
    ['AI 리포트', 'AI_REPORT', 'ai_report', 2],
    ['말로 메모하기', 'VOICE_NOTE', 'voice_note', 4],
  ] as const)(
    '%s에서 막혀 들어오면 그 혜택 장부터 보여 주고 따로 기능 카드를 두지 않는다',
    async (_case, feature, analyticsFeature, index) => {
      // Given
      const routeParams = { feature };

      // When
      const { analytics } = await renderSubscriptionScreen(
        FREE,
        () => Promise.resolve(MONTHLY_AND_ANNUAL),
        routeParams,
      );

      // Then
      expect(await screen.findByTestId(`paywall-benefit-${feature}`)).toBeTruthy();
      expect(screen.queryByTestId('paywall-blocked-feature')).toBeNull();
      expect(
        analytics.trackEvent.mock.calls.filter(
          ([eventName]) => eventName === 'paywall_benefit_viewed',
        ),
      ).toEqual([['paywall_benefit_viewed', { feature: analyticsFeature, index }]]);
    },
  );

  it('혜택 장에 없는 친구 한도에서 막혀 들어오면 기능 카드를 먼저 두고 첫 혜택 장부터 보여 준다', async () => {
    // Given
    const routeParams = { feature: 'FRIEND' };

    // When
    const { analytics } = await renderSubscriptionScreen(
      FREE,
      () => Promise.resolve(MONTHLY_AND_ANNUAL),
      routeParams,
    );

    // Then
    const blockedFeature = await screen.findByTestId('paywall-blocked-feature');
    expect(within(blockedFeature).getByText('친구 무제한')).toBeTruthy();
    expect(screen.getByTestId('paywall-benefit-AI_PARSE')).toBeTruthy();
    expect(analytics.trackEvent).toHaveBeenCalledWith('paywall_benefit_viewed', {
      feature: 'ai_parse',
      index: 1,
    });
    expect(await screen.findByRole('button', { name: '연간으로 시작하기' })).toBeTruthy();
    expect(analytics.trackEvent).toHaveBeenCalledWith('paywall_viewed', {
      view: 'status',
      feature: 'friend_limit',
    });
  });

  it('모르는 기능으로 들어오면 막힌 기능 없이 첫 혜택 장부터 보여 준다', async () => {
    // Given
    const routeParams = { feature: 'UNKNOWN' };

    // When
    const { analytics } = await renderSubscriptionScreen(
      FREE,
      () => Promise.resolve(MONTHLY_AND_ANNUAL),
      routeParams,
    );

    // Then
    expect(await screen.findByRole('button', { name: '연간으로 시작하기' })).toBeTruthy();
    expect(screen.queryByTestId('paywall-blocked-feature')).toBeNull();
    expect(screen.getByTestId('paywall-benefit-AI_PARSE')).toBeTruthy();
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
        status: { activeEntitlements: [] },
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
        status: { activeEntitlements: [] },
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

    it.each([
      ['ko', 'WEEK', 1, '1주 무료', '1주 무료로 시작하기'],
      ['ko', 'MONTH', 1, '1개월 무료', '1개월 무료로 시작하기'],
      ['en', 'WEEK', 2, '2 weeks free', 'Start free for 2 weeks'],
      ['en', 'WEEK', 1, '1 week free', 'Start free for 1 week'],
      ['en', 'MONTH', 1, '1 month free', 'Start free for 1 month'],
    ] as const)(
      '%s: 스토어가 준 체험 기간(%s × %i)을 칩과 버튼에 그대로 쓴다',
      async (language, periodUnit, periodNumberOfUnits, chipLabel, buttonLabel) => {
        // Given
        await i18n.changeLanguage(language);

        // When
        await renderSubscriptionScreen(FREE, () =>
          Promise.resolve(createAnnualTrialOffering({ periodUnit, periodNumberOfUnits })),
        );

        // Then
        expect(await screen.findByRole('button', { name: buttonLabel })).toBeTruthy();
        expect(screen.getByText(chipLabel)).toBeTruthy();
      },
    );

    it('체험이 없는 월간으로 바꾸면 일정을 숨기고 체험 고지 대신 정기결제 고지를 두며, 다시 연간으로 와도 일정은 한 번만 센다', async () => {
      // Given
      const user = userEvent.setup();
      const { analytics } = await renderSubscriptionScreen(FREE, () =>
        Promise.resolve(ANNUAL_WITH_FREE_TRIAL),
      );
      await screen.findByTestId('subscription-trial-timeline');

      // When
      await user.press(screen.getByText('월간 구독'));

      // Then
      expect(await screen.findByRole('button', { name: '월간으로 시작하기' })).toBeTruthy();
      expect(screen.queryByTestId('subscription-trial-timeline')).toBeNull();
      expect(screen.queryByTestId('subscription-trial-disclosure')).toBeNull();
      expect(screen.getByTestId('subscription-renewal-disclosure').props.children).toBe(
        '월\u00A0₩3,900 정기결제 · 언제든 해지할 수 있어요',
      );
      const amountDueToday = screen.getByTestId('subscription-amount-due-today');
      expect(within(amountDueToday).getByText('₩3,900')).toBeTruthy();
      expect(screen.queryByText('체험 끝나기 전 알림')).toBeNull();
      expect(analytics.trackEvent).toHaveBeenCalledWith('paywall_plan_selected', {
        plan_type: 'monthly',
        is_trial: false,
      });

      // When
      await user.press(screen.getByText('연간 구독'));

      // Then
      expect(await screen.findByTestId('subscription-trial-timeline')).toBeTruthy();
      expect(
        analytics.trackEvent.mock.calls.filter(
          ([eventName]) => eventName === 'trial_timeline_viewed',
        ),
      ).toHaveLength(1);
    });

    it('체험 자격이 없으면 체험 문구 없이 일반 연간 버튼을 보여 준다', async () => {
      // When
      await renderSubscriptionScreen(FREE, () => Promise.resolve(MONTHLY_AND_ANNUAL));

      // Then
      expect(await screen.findByRole('button', { name: '연간으로 시작하기' })).toBeTruthy();
      expect(screen.queryByTestId('subscription-trial-timeline')).toBeNull();
      expect(screen.queryByTestId('subscription-plan-free-trial')).toBeNull();
      expect(screen.queryByTestId('subscription-trial-disclosure')).toBeNull();
      const amountDueToday = screen.getByTestId('subscription-amount-due-today');
      expect(within(amountDueToday).getByText('₩29,900')).toBeTruthy();
      expect(screen.getByTestId('subscription-renewal-disclosure').props.children).toBe(
        '연\u00A0₩29,900 정기결제 · 언제든 해지할 수 있어요',
      );
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

    it('체험 중이면 체험 영수증에 종료일·첫 결제일과 금액·해지 방법을 보여 준다', async () => {
      // Given
      const state = createTrialState({ daysLeft: 20, willRenew: true });

      // When
      const { purchases } = await renderSubscriptionScreen(state, () =>
        Promise.resolve(ANNUAL_WITH_FREE_TRIAL),
      );

      // Then
      expect(await screen.findByTestId('subscription-receipt-trial')).toBeTruthy();
      expect(screen.getByText('무료 체험 중')).toBeTruthy();
      expect(screen.getByTestId('subscription-receipt-row-trialEndsOn')).toBeTruthy();
      const firstBilling = screen.getByTestId('subscription-receipt-row-firstBillingDate');
      expect(await within(firstBilling).findByText(/ · 연 ₩29,900$/)).toBeTruthy();
      expect(
        screen.getByText('체험이 끝나기 전에 스토어 구독 설정에서 해지하면 결제되지 않아요'),
      ).toBeTruthy();
      expect(screen.getByText('구독 관리 (스토어 설정)')).toBeTruthy();
      expect(screen.queryByTestId('subscription-ending-notice')).toBeNull();
      expect(purchases.getOffering).toHaveBeenCalled();
    });

    it.each([
      ['자동 갱신 중 3일 남았으면', 3, true, 'D-3', '3일 뒤 연간 구독이 시작돼요'],
      ['자동 갱신 중 하루 남았으면', 1, true, 'D-1', '내일 연간 구독이 시작돼요'],
      ['해지하고 3일 남았으면', 3, false, 'D-3', '무료 체험이 3일 뒤 끝나요'],
      ['해지하고 하루 남았으면', 1, false, 'D-1', '내일 무료 체험이 끝나요'],
    ] as const)(
      '체험이 %s 끝남 안내를 보여 준다',
      async (_case, daysLeft, willRenew, badge, message) => {
        // Given
        const state = createTrialState({ daysLeft, willRenew });

        // When
        await renderSubscriptionScreen(state);

        // Then
        const notice = await screen.findByTestId('subscription-ending-notice');
        expect(within(notice).getByText(badge)).toBeTruthy();
        expect(within(notice).getByText(message)).toBeTruthy();
      },
    );

    it('자동 갱신되는 연간 구독이 7일 남았으면 갱신 푸시와 같은 문장으로 알린다', async () => {
      // Given
      const renewsAt = new Date(Date.now() + 7 * DAY_MS).toISOString();
      const state: ScreenState = {
        tier: 'PREMIUM',
        me: createCurrentUserDto({
          subscriptionStatus: 'ACTIVE',
          isPremium: true,
          premiumSource: 'STORE',
          premiumEndsAt: renewsAt,
          premiumPeriodEndsAt: renewsAt,
          willRenew: true,
          bankedPremiumDays: 0,
          premiumGrantEndedAt: null,
          premiumIsTrial: false,
          premiumPlanType: 'ANNUAL',
        }),
      };

      // When
      await renderSubscriptionScreen(state);

      // Then
      const notice = await screen.findByTestId('subscription-ending-notice');
      expect(within(notice).getByText('D-7')).toBeTruthy();
      expect(within(notice).getByText('7일 뒤 연간 구독이 갱신돼요')).toBeTruthy();
    });

    it('체험이 4일 넘게 남았으면 끝남 안내를 보이지 않는다', async () => {
      // Given
      const state = createTrialState({ daysLeft: 4, willRenew: true });

      // When
      await renderSubscriptionScreen(state);

      // Then
      expect(await screen.findByTestId('subscription-receipt-trial')).toBeTruthy();
      expect(screen.queryByTestId('subscription-ending-notice')).toBeNull();
    });
  });
});
