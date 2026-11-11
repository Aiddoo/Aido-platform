import '@src/shared/i18n/init';
import { PREMIUM_ME_EXAMPLES } from '@src/features/identity/user/__tests__/premium-access.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { type CurrentUserResponse } from '@src/features/identity/user/schemas/user-response.schema';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import {
  createHttpClientStub,
  createPurchasesGatewayStub,
  createTestDi,
  createTestQueryClient,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen, within } from '@testing-library/react-native';

import { SubscriptionReceipt } from './subscription-receipt';

const NOW = new Date('2028-03-01T00:00:00.000Z');

function createTrialMe(overrides: Partial<CurrentUserResponse>) {
  return createCurrentUserDto({
    subscriptionStatus: 'ACTIVE',
    isPremium: true,
    premiumSource: 'STORE',
    premiumPeriodEndsAt: '2028-03-10T04:00:00.000Z',
    premiumEndsAt: '2028-03-10T04:00:00.000Z',
    willRenew: true,
    bankedPremiumDays: 0,
    premiumGrantEndedAt: null,
    premiumIsTrial: true,
    premiumPlanType: 'ANNUAL',
    ...overrides,
  });
}

function createPaidMe(overrides: Partial<CurrentUserResponse>) {
  return createCurrentUserDto({
    subscriptionStatus: 'ACTIVE',
    isPremium: true,
    premiumSource: 'STORE',
    premiumPeriodEndsAt: '2028-03-10T04:00:00.000Z',
    premiumEndsAt: '2028-03-10T04:00:00.000Z',
    willRenew: true,
    bankedPremiumDays: 0,
    premiumGrantEndedAt: null,
    premiumIsTrial: false,
    premiumPlanType: 'MONTHLY',
    ...overrides,
  });
}

async function readRows(me: CurrentUserResponse) {
  const purchases = createPurchasesGatewayStub();
  // 요금제를 받는 중에 머물러 금액 없이 날짜·이름만 보인다
  purchases.getOffering.mockImplementation(() => new Promise(() => {}));
  const di = createTestDi({ httpClient: createHttpClientStub(), purchasesGateway: purchases });
  di.purchasesSession.configure();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), toUser(me));

  await renderScreen(
    <LocalDateProvider>
      <SubscriptionReceipt />
    </LocalDateProvider>,
    { di, queryClient },
  );

  return screen.queryAllByTestId(/^subscription-receipt-row-/).map((row) => ({
    row: String(row.props.testID).replace('subscription-receipt-row-', ''),
    texts: within(row)
      .queryAllByText(/./)
      .map((text) => String(text.props.children)),
  }));
}

const SCENARIOS = {
  admin: createCurrentUserDto({ role: 'ADMIN', subscriptionStatus: 'FREE' }),
  adminWithReward: createCurrentUserDto({
    role: 'ADMIN',
    subscriptionStatus: 'FREE',
    premiumSource: 'GRANT',
    premiumPeriodEndsAt: '2028-03-12T04:00:00.000Z',
    premiumEndsAt: '2028-03-12T04:00:00.000Z',
    bankedPremiumDays: 3,
  }),
  reward: PREMIUM_ME_EXAMPLES.newRewardAfterEnded,
  rewardWithBanked: PREMIUM_ME_EXAMPLES.rewardDuringReward,
  paidRenewing: createPaidMe({}),
  paidRenewingWithBanked: PREMIUM_ME_EXAMPLES.rewardDuringRenewingSubscription,
  paidCancelled: createPaidMe({ willRenew: false }),
  paidCancelledWithBanked: PREMIUM_ME_EXAMPLES.cancelledWithBanked,
  trialRenewing: createTrialMe({}),
  trialRenewingWithBanked: PREMIUM_ME_EXAMPLES.trialDuringReward,
  trialCancelled: createTrialMe({ willRenew: false }),
  trialCancelledWithBanked: createTrialMe({ willRenew: false, bankedPremiumDays: 5 }),
  paidRenewalPending: createPaidMe({
    premiumPeriodEndsAt: '2028-02-29T23:00:00.000Z',
    premiumEndsAt: '2028-02-29T23:00:00.000Z',
  }),
} as const satisfies Record<string, CurrentUserResponse>;

/** 행 정리 전 구현이 그리던 줄을 그대로 옮긴 표다. [행, [이름, 값]] 순서도 같다 */
const EXPECTED_ROWS = {
  admin: [['account', ['계정', '관리자']]],
  adminWithReward: [
    ['account', ['계정', '관리자']],
    ['rewardRecord', ['초대 보상 기록', '3월 12일까지']],
    ['bankedReward', ['이어서 받을 보상', '3일']],
  ],
  reward: [
    ['rewardPeriod', ['이용 기간', '3월 12일까지']],
    ['daysLeft', ['남은 기간', '11일']],
  ],
  rewardWithBanked: [
    ['rewardPeriod', ['이용 기간', '3월 4일까지']],
    ['bankedReward', ['이어서 받을 보상', '7일']],
    ['overallPeriod', ['전체 이용 기간', '3월 11일까지']],
    ['daysLeft', ['남은 기간', '10일']],
  ],
  paidRenewing: [
    ['plan', ['요금제', '월간 구독']],
    ['nextBillingDate', ['다음 결제일', '2028년 3월 10일']],
    ['autoRenewal', ['구독 상태', '자동 갱신']],
  ],
  paidRenewingWithBanked: [
    ['plan', ['요금제', '구독']],
    ['nextBillingDate', ['다음 결제일', '2028년 3월 10일']],
    ['autoRenewal', ['구독 상태', '자동 갱신']],
    ['bankedReward', ['이어서 받을 보상', '7일']],
  ],
  paidCancelled: [
    ['plan', ['요금제', '월간 구독']],
    ['subscriptionEndsOn', ['구독 종료일', '2028년 3월 10일']],
    ['autoRenewal', ['구독 상태', '자동 갱신 꺼짐']],
  ],
  paidCancelledWithBanked: [
    ['plan', ['요금제', '구독']],
    ['subscriptionEndsOn', ['구독 종료일', '2028년 3월 10일']],
    ['autoRenewal', ['구독 상태', '자동 갱신 꺼짐']],
    ['bankedReward', ['이어서 받을 보상', '7일 · 2028년 3월 17일까지']],
  ],
  trialRenewing: [
    ['plan', ['요금제', '연간 구독']],
    ['trialEndsOn', ['체험 종료일', '2028년 3월 10일']],
    ['firstBillingDate', ['첫 결제일', '2028년 3월 10일']],
    ['autoRenewal', ['구독 상태', '자동 갱신']],
  ],
  trialRenewingWithBanked: [
    ['plan', ['요금제', '구독']],
    ['trialEndsOn', ['체험 종료일', '2028년 3월 26일']],
    ['firstBillingDate', ['첫 결제일', '2028년 3월 26일']],
    ['autoRenewal', ['구독 상태', '자동 갱신']],
    ['bankedReward', ['이어서 받을 보상', '5일']],
  ],
  trialCancelled: [
    ['plan', ['요금제', '연간 구독']],
    ['trialEndsOn', ['체험 종료일', '2028년 3월 10일']],
    ['autoRenewal', ['구독 상태', '자동 갱신 꺼짐']],
  ],
  trialCancelledWithBanked: [
    ['plan', ['요금제', '연간 구독']],
    ['trialEndsOn', ['체험 종료일', '2028년 3월 10일']],
    ['autoRenewal', ['구독 상태', '자동 갱신 꺼짐']],
    ['bankedReward', ['이어서 받을 보상', '5일 · 2028년 3월 10일까지']],
  ],
  paidRenewalPending: [
    ['plan', ['요금제', '월간 구독']],
    ['renewalPending', ['다음 결제일', '갱신 확인 중']],
    ['autoRenewal', ['구독 상태', '자동 갱신']],
  ],
} as const satisfies Record<
  keyof typeof SCENARIOS,
  readonly (readonly [string, readonly string[]])[]
>;

const SCENARIO_NAMES = [
  'admin',
  'adminWithReward',
  'reward',
  'rewardWithBanked',
  'paidRenewing',
  'paidRenewingWithBanked',
  'paidCancelled',
  'paidCancelledWithBanked',
  'trialRenewing',
  'trialRenewingWithBanked',
  'trialCancelled',
  'trialCancelledWithBanked',
  'paidRenewalPending',
] as const satisfies readonly (keyof typeof SCENARIOS)[];

describe('SubscriptionReceipt', () => {
  setupFakeTimersPerTest({ now: NOW });

  it.each(SCENARIO_NAMES)('%s 영수증은 정해진 줄을 순서대로 그린다', async (name) => {
    // When
    const rows = await readRows(SCENARIOS[name]);

    // Then
    expect(rows).toEqual(EXPECTED_ROWS[name].map(([row, texts]) => ({ row, texts })));
  });
});
