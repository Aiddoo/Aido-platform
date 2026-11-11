import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { PREMIUM_ME_EXAMPLES } from '@src/features/identity/user/__tests__/premium-access.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { type CurrentUserResponse } from '@src/features/identity/user/schemas/user-response.schema';
import { i18n } from '@src/shared/i18n';
import {
  createHttpClientStub,
  createPurchasesGatewayStub,
  createTestDi,
  createTestQueryClient,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { useMutation, useQuery } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react-native';

import { type SubscriptionPlan } from '../domains/subscription.model';
import { usePurchaseMutationOptions } from './subscription.mutations';

const SYNC_PENDING_TOAST = i18n.t('subscription:toast.purchaseSyncPending');

type PurchasePlan = Pick<SubscriptionPlan, 'identifier' | 'planType' | 'freeTrial'>;

const ANNUAL_TRIAL_PLAN = {
  identifier: 'annual',
  planType: 'annual',
  freeTrial: { periodUnit: 'week', periodNumberOfUnits: 2 },
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
  const { result } = await renderScreenHook(
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
    getResult: () => result.current.data,
  };
}

describe('결제 성공', () => {
  setupFakeTimersPerTest();

  it.each([
    [
      '무료 사용자가 체험을 시작하면',
      FREE_ME,
      createStoreMe({ isTrial: true, bankedDays: 0 }),
      ANNUAL_TRIAL_PLAN,
      false,
    ],
    [
      '무료 사용자가 바로 결제하면',
      FREE_ME,
      createStoreMe({ isTrial: false, bankedDays: 0 }),
      ANNUAL_PLAN,
      false,
    ],
    [
      '초대 보상 기간에 체험을 시작하면',
      REWARD_ME,
      createStoreMe({ isTrial: true, bankedDays: 5 }),
      ANNUAL_TRIAL_PLAN,
      true,
    ],
    [
      '초대 보상 기간에 바로 결제하면',
      REWARD_ME,
      PREMIUM_ME_EXAMPLES.buyDuringReward,
      ANNUAL_PLAN,
      true,
    ],
  ] as const)(
    '%s 시작 화면이 알리므로 토스트 없이 보상이 이어지는지만 돌려준다',
    async (_case, previousMe, serverMe, plan, hadRewardOnly) => {
      // Given
      const { purchase, getResult } = await renderPurchase({ previousMe, serverMe });

      // When
      await purchase(plan);

      // Then
      await waitFor(() => expect(getResult()).toEqual({ isReflected: true, hadRewardOnly }));
      expect(screen.queryByText(SYNC_PENDING_TOAST)).toBeNull();
    },
  );

  it('서버가 끝내 결제를 반영하지 못하면 반영을 기다린다고 알린다', async () => {
    // Given
    const { purchase, getResult } = await renderPurchase({
      previousMe: FREE_ME,
      serverMe: FREE_ME,
    });

    // When
    await purchase(ANNUAL_TRIAL_PLAN);

    // Then
    expect(
      await screen.findAllByText(SYNC_PENDING_TOAST, {}, { timeout: LONGER_THAN_STORE_SYNC_MS }),
    ).not.toHaveLength(0);
    await waitFor(() => expect(getResult()).toEqual({ isReflected: false, hadRewardOnly: false }));
  });
});
