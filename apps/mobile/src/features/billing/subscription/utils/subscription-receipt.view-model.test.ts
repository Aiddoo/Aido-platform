import { PREMIUM_ME_EXAMPLES } from '@src/features/identity/user/__tests__/premium-access.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { type CurrentUserResponse } from '@src/features/identity/user/schemas/user-response.schema';
import { type Instant, toInstant } from '@src/shared/date/instant';

import {
  toReceiptDateLabel,
  toSubscriptionReceiptViewModel,
} from './subscription-receipt.view-model';

const SEOUL = 'Asia/Seoul';
// 2028년 3월 1일 12:00 KST
const NOW = toInstant('2028-03-01T03:00:00Z');

interface ReceiptOptions {
  isStoreConfigured?: boolean;
  now?: Instant;
}

/** 서버 /me 응답 모양 그대로 받아 앱 mapper를 거친 사용자로 영수증을 만든다 */
function createReceipt(
  me: CurrentUserResponse,
  { isStoreConfigured = true, now = NOW }: ReceiptOptions = {},
) {
  return toSubscriptionReceiptViewModel(toUser(me), { isStoreConfigured, now, timeZone: SEOUL });
}

describe('toSubscriptionReceiptViewModel', () => {
  describe('무료 체험', () => {
    const TRIAL_ENDS_AT = toInstant('2028-03-26T04:00:00.000Z');

    function createTrialMe(overrides: Partial<CurrentUserResponse> = {}): CurrentUserResponse {
      return { ...PREMIUM_ME_EXAMPLES.trialDuringReward, ...overrides };
    }

    it('G. 보상 중에 체험을 시작했으면 체험 종료일과 첫 결제일을 서버 기간 끝으로 보이고 해지 방법을 안내한다', () => {
      // When
      const result = createReceipt(createTrialMe());

      // Then
      expect(result).toEqual({
        variant: 'trial',
        details: {
          planType: null,
          trialEndsOn: TRIAL_ENDS_AT,
          billing: { type: 'firstBillingDate', date: TRIAL_ENDS_AT },
          willRenew: true,
          banked: { days: 5, endsAt: null },
        },
        footnote: { type: 'cancelTrialInStore' },
        primaryAction: 'manage',
        endingNotice: null,
      });
    });

    it.each([
      ['4일 남았으면 아직 알리지 않는다', '2028-03-22T03:00:00Z', null],
      ['3일 남았으면 D-3으로 알린다', '2028-03-23T03:00:00Z', 3],
      ['하루 남았으면 D-1로 알린다', '2028-03-25T03:00:00Z', 1],
      ['끝나는 날이면 오늘로 알린다', '2028-03-26T01:00:00Z', 0],
    ] as const)('자동 갱신 중인 체험이 %s', (_case, now, expectedDaysLeft) => {
      // When
      const result = createReceipt(createTrialMe(), { now: toInstant(now) });

      // Then
      expect(result.endingNotice).toEqual(
        expectedDaysLeft == null
          ? null
          : { daysLeft: expectedDaysLeft, willRenew: true, planType: null },
      );
    });

    it('체험을 해지했으면 결제일 없이 종료일만 보이고 끝나면 무료로 돌아간다고 알린다', () => {
      // Given
      const me = createTrialMe({
        willRenew: false,
        bankedPremiumDays: 0,
        premiumEndsAt: '2028-03-26T04:00:00.000Z',
      });

      // When
      // 체험이 끝나기 하루 전
      const result = createReceipt(me, { now: toInstant('2028-03-25T03:00:00Z') });

      // Then
      expect(result).toMatchObject({
        details: { trialEndsOn: TRIAL_ENDS_AT, billing: null, willRenew: false, banked: null },
      });
      expect(result.footnote).toEqual({ type: 'returnsToFreePlan', date: TRIAL_ENDS_AT });
      expect(result.endingNotice).toEqual({ daysLeft: 1, willRenew: false, planType: null });
    });

    it('체험 끝이 지났는데 결제가 아직 반영되지 않았으면 갱신 확인 중으로 보이고 끝남 안내를 하지 않는다', () => {
      // When
      const result = createReceipt(createTrialMe(), { now: toInstant('2028-03-26T05:00:00Z') });

      // Then
      expect(result).toMatchObject({ details: { billing: { type: 'renewalPending' } } });
      expect(result.endingNotice).toBeNull();
    });

    it('체험에서 결제로 넘어가면 일반 결제 영수증으로 돌아간다', () => {
      // When
      const result = createReceipt(createTrialMe({ premiumIsTrial: false }));

      // Then
      expect(result.variant).toBe('paid');
      expect(result).toMatchObject({
        details: { billing: { type: 'nextBillingDate', date: TRIAL_ENDS_AT } },
      });
    });
  });

  describe('스토어 구독', () => {
    it('A. 보상 중에 구독했으면 다음 결제일은 스토어 만료로 보이고, 자동 갱신 중이라 쌓아 둔 보상은 날짜 없이 일수만 보인다', () => {
      // When
      const result = createReceipt(PREMIUM_ME_EXAMPLES.buyDuringReward);

      // Then
      // 갱신마다 밀리는 보상 끝 날짜는 고정 날짜처럼 보이지 않게 뺀다
      expect(result).toEqual({
        variant: 'paid',
        details: {
          planType: null,
          billing: { type: 'nextBillingDate', date: toInstant('2028-03-10T04:00:00.000Z') },
          willRenew: true,
          banked: { days: 5, endsAt: null },
        },
        footnote: { type: 'rewardStartsAfterSubscription', days: 5 },
        primaryAction: 'manage',
        endingNotice: null,
      });
    });

    it.each([
      [
        'C. 자동 갱신 구독 중에 보상을 받았으면',
        PREMIUM_ME_EXAMPLES.rewardDuringRenewingSubscription,
        7,
      ],
      [
        'F. 쌓아 둔 보상이 시작된 뒤 다시 구독했으면',
        PREMIUM_ME_EXAMPLES.resubscribedAfterBankedStarted,
        5,
      ],
    ] as const)('%s 자동 갱신 중이라 쌓아 둔 %i일을 날짜 없이 보인다', (_case, me, days) => {
      // When
      const result = createReceipt(me);

      // Then
      expect(result).toMatchObject({ details: { banked: { days, endsAt: null } } });
      expect(result.footnote).toEqual({ type: 'rewardStartsAfterSubscription', days });
    });

    it('E. 구독을 취소했고 보상이 쌓여 있으면 종료일과 보상을 보이고 내일 끝나도 끝남 안내를 하지 않는다', () => {
      // When
      // 구독이 3월 10일에 끝나기 하루 전
      const result = createReceipt(PREMIUM_ME_EXAMPLES.cancelledWithBanked, {
        now: toInstant('2028-03-09T03:00:00Z'),
      });

      // Then
      expect(result).toMatchObject({
        details: {
          billing: { type: 'subscriptionEndsOn', date: toInstant('2028-03-10T04:00:00.000Z') },
          willRenew: false,
          banked: { days: 7, endsAt: toInstant('2028-03-17T04:00:00.000Z') },
        },
      });
      expect(result.endingNotice).toBeNull();
    });

    it('취소했고 쌓아 둔 보상이 없으면 무료 플랜으로 돌아가는 날을 안내하고 하루 전에 끝남을 알린다', () => {
      // Given
      const me = createCurrentUserDto({
        subscriptionStatus: 'ACTIVE',
        premiumSource: 'STORE',
        premiumPeriodEndsAt: '2028-03-10T04:00:00.000Z',
        premiumEndsAt: '2028-03-10T04:00:00.000Z',
        willRenew: false,
        bankedPremiumDays: 0,
        premiumGrantEndedAt: null,
      });

      // When
      const result = createReceipt(me, { now: toInstant('2028-03-09T03:00:00Z') });

      // Then
      expect(result.footnote).toEqual({
        type: 'returnsToFreePlan',
        date: toInstant('2028-03-10T04:00:00.000Z'),
      });
      expect(result.endingNotice).toBe('tomorrow');
    });

    it('자동 갱신 결제 예정 시각이 지났는데 갱신이 아직 반영되지 않았으면 지난 날짜 대신 갱신 확인 중으로 보인다', () => {
      // When
      // 다음 결제 예정(3월 10일 13:00 KST) 1시간 뒤, 갱신 웹훅 전이다
      const result = createReceipt(PREMIUM_ME_EXAMPLES.buyDuringReward, {
        now: toInstant('2028-03-10T05:00:00Z'),
      });

      // Then
      expect(result).toMatchObject({ details: { billing: { type: 'renewalPending' } } });
    });

    it('자동 갱신 결제 예정 시각 1분 전에는 다음 결제일을 그대로 보인다', () => {
      // When
      const result = createReceipt(PREMIUM_ME_EXAMPLES.buyDuringReward, {
        now: toInstant('2028-03-10T03:59:00Z'),
      });

      // Then
      expect(result).toMatchObject({
        details: {
          billing: { type: 'nextBillingDate', date: toInstant('2028-03-10T04:00:00.000Z') },
        },
      });
    });

    it('구독 상태만 ACTIVE이고 프리미엄 출처가 없으면 날짜 행 없이 구독 관리만 보인다', () => {
      // When
      const result = createReceipt(createCurrentUserDto());

      // Then
      expect(result).toEqual({
        variant: 'paid',
        details: null,
        footnote: null,
        primaryAction: 'manage',
        endingNotice: null,
      });
    });
  });

  describe('초대 보상', () => {
    it('D. 끝난 뒤 새 보상을 받았으면 이용 기간과 남은 일수를 보이고 무료 플랜으로 돌아가는 날을 안내한다', () => {
      // When
      const result = createReceipt(PREMIUM_ME_EXAMPLES.newRewardAfterEnded);

      // Then
      // 결제 용어(다음 결제일·자동 갱신) 행이 없다
      expect(result).toEqual({
        variant: 'reward',
        details: {
          periodEndsAt: toInstant('2028-03-12T04:00:00.000Z'),
          chained: null,
          daysLeft: { days: 11, endingNotice: null },
        },
        footnote: { type: 'returnsToFreePlan', date: toInstant('2028-03-12T04:00:00.000Z') },
        primaryAction: 'subscribe',
        endingNotice: null,
      });
    });

    it('B. 보상 중에 보상을 또 받으면 지금 보상, 이어서 받을 보상, 전체 끝을 함께 보인다', () => {
      // When
      const result = createReceipt(PREMIUM_ME_EXAMPLES.rewardDuringReward);

      // Then
      // 남은 기간과 무료 플랜 안내는 전체 끝(3월 11일) 기준이다
      expect(result).toMatchObject({
        details: {
          periodEndsAt: toInstant('2028-03-04T04:00:00.000Z'),
          chained: { bankedDays: 7, overallEndsAt: toInstant('2028-03-11T04:00:00.000Z') },
          daysLeft: { days: 10, endingNotice: null },
        },
      });
      expect(result.footnote).toEqual({
        type: 'returnsToFreePlan',
        date: toInstant('2028-03-11T04:00:00.000Z'),
      });
    });

    it('B. 지금 보상이 내일 끝나도 보상이 이어지면 끝남 안내를 하지 않는다', () => {
      // When
      const result = createReceipt(PREMIUM_ME_EXAMPLES.rewardDuringReward, {
        now: toInstant('2028-03-03T03:00:00Z'),
      });

      // Then
      expect(result.endingNotice).toBeNull();
    });

    it.each([
      ['하루 전', '2028-03-16T03:00:00Z', 1, 'tomorrow'],
      ['마지막 날', '2028-03-17T01:00:00Z', 0, 'today'],
    ] as const)(
      'E. 쌓아 둔 보상이 시작된 뒤 %s이면 남은 기간 행과 끝남 안내에 %s를 담는다',
      (_case, now, days, notice) => {
        // When
        const result = createReceipt(PREMIUM_ME_EXAMPLES.bankedRewardStarted, {
          now: toInstant(now),
        });

        // Then
        expect(result).toMatchObject({ details: { daysLeft: { days, endingNotice: notice } } });
        expect(result.endingNotice).toBe(notice);
      },
    );

    it('스토어 결제를 쓸 수 없으면 구독 버튼을 보이지 않는다', () => {
      // When
      const result = createReceipt(PREMIUM_ME_EXAMPLES.newRewardAfterEnded, {
        isStoreConfigured: false,
      });

      // Then
      expect(result.primaryAction).toBeNull();
    });
  });

  describe('관리자', () => {
    it('구독·보상이 없으면 출처 없이 계정 행만 보이고 구독·관리 버튼을 숨긴다', () => {
      // When
      const result = createReceipt(
        createCurrentUserDto({
          role: 'ADMIN',
          premiumSource: null,
          premiumPeriodEndsAt: null,
          premiumEndsAt: null,
          willRenew: false,
          bankedPremiumDays: 0,
          premiumGrantEndedAt: null,
        }),
      );

      // Then
      expect(result).toEqual({
        variant: 'admin',
        details: { rewardRecordEndsAt: null, bankedDays: null },
        footnote: null,
        primaryAction: null,
        endingNotice: null,
      });
    });

    it('초대 보상을 받았으면 보상 기록을 보이지만 끝남 안내는 하지 않는다', () => {
      // When
      const result = createReceipt(
        { ...PREMIUM_ME_EXAMPLES.newRewardAfterEnded, role: 'ADMIN' },
        { now: toInstant('2028-03-11T03:00:00Z') },
      );

      // Then
      expect(result).toMatchObject({
        details: { rewardRecordEndsAt: toInstant('2028-03-12T04:00:00.000Z'), bankedDays: null },
      });
      expect(result.endingNotice).toBeNull();
      expect(result.primaryAction).toBeNull();
    });
  });

  describe('요금제와 갱신 안내', () => {
    // 3월 10일 13:00 KST에 자동 갱신되는 구독
    const RENEWS_AT = '2028-03-10T04:00:00.000Z';

    function createRenewingMe(overrides: Partial<CurrentUserResponse> = {}): CurrentUserResponse {
      return {
        ...PREMIUM_ME_EXAMPLES.buyDuringReward,
        bankedPremiumDays: 0,
        premiumEndsAt: RENEWS_AT,
        premiumPlanType: 'ANNUAL',
        ...overrides,
      };
    }

    it.each([
      ['서버가 연간이라고 보내면 연간', 'ANNUAL', 'annual'],
      ['서버가 월간이라고 보내면 월간', 'MONTHLY', 'monthly'],
      ['구버전 서버나 모르는 상품이라 없으면 요금제 없이', undefined, null],
    ] as const)('%s 요금제 줄을 보인다', (_case, premiumPlanType, planType) => {
      // When
      const result = createReceipt(createRenewingMe({ premiumPlanType }));

      // Then
      expect(result).toMatchObject({ details: { planType } });
    });

    it.each([
      ['7일 전이면 갱신 7일 전으로 알린다', '2028-03-03T03:00:00Z', 7],
      ['하루 전이면 D-1로 알린다', '2028-03-09T03:00:00Z', 1],
    ] as const)('자동 갱신되는 연간 구독은 %s', (_case, now, daysLeft) => {
      // When
      const result = createReceipt(createRenewingMe(), { now: toInstant(now) });

      // Then
      expect(result.endingNotice).toEqual({ type: 'annualRenewing', daysLeft });
    });

    it.each([
      ['8일 전이면', createRenewingMe(), '2028-03-02T03:00:00Z'],
      ['월간이면', createRenewingMe({ premiumPlanType: 'MONTHLY' }), '2028-03-09T03:00:00Z'],
      ['요금제를 모르면', createRenewingMe({ premiumPlanType: null }), '2028-03-09T03:00:00Z'],
    ] as const)('%s 갱신 안내를 하지 않는다', (_case, me, now) => {
      // When
      const result = createReceipt(me, { now: toInstant(now) });

      // Then
      expect(result.endingNotice).toBeNull();
    });

    it('자동 갱신을 끄고 보상이 쌓여 있으면 구독이 끝나는 날부터 보상이 이어진다고 안내한다', () => {
      // When
      const result = createReceipt(PREMIUM_ME_EXAMPLES.cancelledWithBanked);

      // Then
      expect(result.footnote).toEqual({
        type: 'rewardStartsOn',
        days: 7,
        date: toInstant('2028-03-10T04:00:00.000Z'),
      });
    });
  });
});

describe('toReceiptDateLabel', () => {
  it.each([
    ['paid', 'fullDate'],
    ['trial', 'fullDate'],
    ['reward', 'yearAware'],
    ['admin', 'yearAware'],
  ] as const)('%s 영수증 날짜는 %s로 보인다', (variant, expected) => {
    // When
    const label = toReceiptDateLabel(variant);

    // Then
    expect(label).toBe(expected);
  });
});
