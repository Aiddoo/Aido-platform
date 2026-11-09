import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { PREMIUM_ME_EXAMPLES } from '@src/features/identity/user/__tests__/premium-access.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { type CurrentUserResponse } from '@src/features/identity/user/schemas/user-response.schema';
import {
  createHttpClientStub,
  createPurchasesGatewayStub,
  createTestDi,
  createTestQueryClient,
  renderUiHook,
  setupFakeTimersPerTest,
} from '@src/shared/__tests__';
import { i18n } from '@src/shared/i18n';
import { useMutation, useQuery } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';

import { type SubscriptionPlan } from '../domains/subscription.model';
import { usePurchaseMutationOptions } from './subscription.mutations';

const TOAST = {
  trial: i18n.t('subscription:toast.trialStartSuccess'),
  trialWithReward: i18n.t('subscription:toast.trialStartSuccessWithReward'),
  paid: i18n.t('subscription:toast.purchaseSuccess'),
  paidWithReward: i18n.t('subscription:toast.purchaseSuccessWithReward'),
  syncPending: i18n.t('subscription:toast.purchaseSyncPending'),
};

type PurchasePlan = Pick<SubscriptionPlan, 'identifier' | 'planType' | 'freeTrial'>;

const ANNUAL_TRIAL_PLAN = {
  identifier: 'annual',
  planType: 'annual',
  freeTrial: { periodUnit: 'month', periodNumberOfUnits: 1 },
} as const satisfies PurchasePlan;

const ANNUAL_PLAN = {
  identifier: 'annual',
  planType: 'annual',
  freeTrial: null,
} as const satisfies PurchasePlan;

/** 결제 뒤 내 정보를 다시 받는 간격을 모두 합친 10초 남짓보다 길게 기다린다 */
const LONGER_THAN_STORE_SYNC_MS = 15_000;

const FREE_ME = createCurrentUserDto({ subscriptionStatus: 'FREE' });
const REWARD_ME = PREMIUM_ME_EXAMPLES.newRewardAfterEnded;

function createStoreMe({ isTrial, bankedDays }: { isTrial: boolean; bankedDays: number }) {
  return createCurrentUserDto({
    subscriptionStatus: 'ACTIVE',
    isPremium: true,
    premiumSource: 'STORE',
    premiumPeriodEndsAt: '2028-03-10T04:00:00.000Z',
    premiumEndsAt: '2028-03-10T04:00:00.000Z',
    willRenew: true,
    bankedPremiumDays: bankedDays,
    premiumGrantEndedAt: null,
    premiumIsTrial: isTrial,
  });
}

/** 결제 전 내 정보는 캐시에 두고, 결제 뒤 서버가 돌려줄 내 정보는 `serverMe`로 정한다 */
async function renderPurchase({
  previousMe,
  serverMe,
}: {
  previousMe: CurrentUserResponse;
  serverMe: CurrentUserResponse;
}) {
  const purchases = createPurchasesGatewayStub();
  purchases.purchase.mockResolvedValue({
    type: 'purchased',
    status: { activeEntitlements: [{ store: 'APP_STORE', productIdentifier: 'aido.annual' }] },
  });
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(serverMe));
  const di = createTestDi({ httpClient, purchasesGateway: purchases });
  di.purchasesSession.configure();
  // 결제 전 캐시가 화면을 여는 순간 서버 값으로 바뀌지 않게 다시 받지 않는다
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), toUser(previousMe));

  // 결제 화면처럼 내 정보를 구독해 두어야 결제 뒤 다시 받을 수 있다
  const { result } = await renderUiHook(
    () => {
      useQuery(useGetMeQueryOptions());
      return useMutation(usePurchaseMutationOptions());
    },
    { di, queryClient, withOverlay: true },
  );

  return {
    purchase: async (plan: PurchasePlan) => {
      await act(async () => {
        result.current.mutate(plan);
      });
    },
  };
}

describe('결제 성공 안내', () => {
  setupFakeTimersPerTest();

  it('무료 사용자가 체험을 시작하면 체험 시작만 알린다', async () => {
    // Given
    const { purchase } = await renderPurchase({
      previousMe: FREE_ME,
      serverMe: createStoreMe({ isTrial: true, bankedDays: 0 }),
    });

    // When
    await purchase(ANNUAL_TRIAL_PLAN);

    // Then
    expect(await screen.findAllByText(TOAST.trial)).not.toHaveLength(0);
    expect(screen.queryByText(TOAST.trialWithReward)).toBeNull();
  });

  it('초대 보상 기간에 체험을 시작하면 남은 보상이 구독 뒤에 이어진다고 함께 알린다', async () => {
    // Given
    const { purchase } = await renderPurchase({
      previousMe: REWARD_ME,
      serverMe: createStoreMe({ isTrial: true, bankedDays: 5 }),
    });

    // When
    await purchase(ANNUAL_TRIAL_PLAN);

    // Then
    expect(await screen.findAllByText(TOAST.trialWithReward)).not.toHaveLength(0);
    expect(screen.queryByText(TOAST.trial)).toBeNull();
  });

  it('무료 사용자가 바로 결제하면 구독 시작만 알린다', async () => {
    // Given
    const { purchase } = await renderPurchase({
      previousMe: FREE_ME,
      serverMe: createStoreMe({ isTrial: false, bankedDays: 0 }),
    });

    // When
    await purchase(ANNUAL_PLAN);

    // Then
    expect(await screen.findAllByText(TOAST.paid)).not.toHaveLength(0);
    expect(screen.queryByText(TOAST.trial)).toBeNull();
  });

  it('초대 보상 기간에 바로 결제하면 남은 보상이 구독 뒤에 이어진다고 함께 알린다', async () => {
    // Given
    const { purchase } = await renderPurchase({
      previousMe: REWARD_ME,
      serverMe: PREMIUM_ME_EXAMPLES.buyDuringReward,
    });

    // When
    await purchase(ANNUAL_PLAN);

    // Then
    expect(await screen.findAllByText(TOAST.paidWithReward)).not.toHaveLength(0);
    expect(screen.queryByText(TOAST.trialWithReward)).toBeNull();
  });

  it('서버가 끝내 결제를 반영하지 못하면 체험이어도 반영을 기다린다고만 알린다', async () => {
    // Given
    const { purchase } = await renderPurchase({ previousMe: FREE_ME, serverMe: FREE_ME });

    // When
    await purchase(ANNUAL_TRIAL_PLAN);

    // Then
    expect(
      await screen.findAllByText(TOAST.syncPending, {}, { timeout: LONGER_THAN_STORE_SYNC_MS }),
    ).not.toHaveLength(0);
    expect(screen.queryByText(TOAST.trial)).toBeNull();
  });
});
