import type { CurrentUser } from '@aido/api';
import { createCurrentUserDto } from '@src/features/user/__tests__/user.factories';
import { toUser } from '@src/features/user/apis/user.mapper';

import { PREMIUM_ME_EXAMPLES } from '../../__tests__/premium-access.factories';
import { toSubscriptionReceiptViewModel } from './subscription-receipt.view-model';

const SEOUL = 'Asia/Seoul';
// 2028년 3월 1일 12:00 KST
const NOW = new Date('2028-03-01T03:00:00Z');

interface ReceiptOptions {
  isStoreConfigured?: boolean;
  now?: Date;
}

/** 서버 /me 응답 모양 그대로 받아 앱 mapper를 거친 사용자로 영수증을 만든다 */
function receiptOf(me: CurrentUser, { isStoreConfigured = true, now = NOW }: ReceiptOptions = {}) {
  return toSubscriptionReceiptViewModel(toUser(me), { isStoreConfigured, now, timeZone: SEOUL });
}

describe('toSubscriptionReceiptViewModel', () => {
  describe('스토어 구독', () => {
    it('A. 보상 중에 구독했으면 다음 결제일은 스토어 만료로, 쌓아 둔 보상은 전체 끝까지로 보인다', () => {
      // When
      const result = receiptOf(PREMIUM_ME_EXAMPLES.buyDuringReward);

      // Then 결제일(3월 10일)과 보상 끝(3월 15일)이 서로 다른 날짜다
      expect(result).toEqual({
        variant: 'paid',
        rows: [
          { type: 'nextBillingDate', date: new Date('2028-03-10T04:00:00.000Z') },
          { type: 'autoRenewal', willRenew: true },
          { type: 'bankedReward', days: 5, endsAt: new Date('2028-03-15T07:00:00.000Z') },
        ],
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
        '2028-03-17T07:00:00.000Z',
      ],
      [
        'F. 쌓아 둔 보상이 시작된 뒤 다시 구독했으면',
        PREMIUM_ME_EXAMPLES.resubscribedAfterBankedStarted,
        5,
        '2028-04-17T07:00:00.000Z',
      ],
    ] as const)('%s 쌓아 둔 %i일을 서버의 전체 끝(%s)까지로 보인다', (_case, me, days, endsAt) => {
      // When
      const result = receiptOf(me);

      // Then
      expect(result.rows).toContainEqual({ type: 'bankedReward', days, endsAt: new Date(endsAt) });
      expect(result.footnote).toEqual({ type: 'rewardStartsAfterSubscription', days });
    });

    it('E. 구독을 취소했고 보상이 쌓여 있으면 종료일과 보상을 보이고 내일 끝나도 끝남 안내를 하지 않는다', () => {
      // When 구독이 3월 10일에 끝나기 하루 전
      const result = receiptOf(PREMIUM_ME_EXAMPLES.cancelledWithBanked, {
        now: new Date('2028-03-09T03:00:00Z'),
      });

      // Then
      expect(result.rows).toEqual([
        { type: 'subscriptionEndsOn', date: new Date('2028-03-10T04:00:00.000Z') },
        { type: 'autoRenewal', willRenew: false },
        { type: 'bankedReward', days: 7, endsAt: new Date('2028-03-17T04:00:00.000Z') },
      ]);
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
      const result = receiptOf(me, { now: new Date('2028-03-09T03:00:00Z') });

      // Then
      expect(result.footnote).toEqual({
        type: 'returnsToFreePlan',
        date: new Date('2028-03-10T04:00:00.000Z'),
      });
      expect(result.endingNotice).toBe('tomorrow');
    });

    it('구버전 서버라 출처가 없으면 날짜 행 없이 구독 관리만 보인다', () => {
      // When
      const result = receiptOf(createCurrentUserDto());

      // Then
      expect(result).toEqual({
        variant: 'paid',
        rows: [],
        footnote: null,
        primaryAction: 'manage',
        endingNotice: null,
      });
    });
  });

  describe('초대 보상', () => {
    it('D. 끝난 뒤 새 보상을 받았으면 이용 기간과 남은 일수를 보이고 무료 플랜으로 돌아가는 날을 안내한다', () => {
      // When
      const result = receiptOf(PREMIUM_ME_EXAMPLES.newRewardAfterEnded);

      // Then 결제 용어(다음 결제일·자동 갱신) 행이 없다
      expect(result).toEqual({
        variant: 'reward',
        rows: [
          { type: 'rewardPeriod', endsAt: new Date('2028-03-12T04:00:00.000Z') },
          { type: 'daysLeft', days: 11, endingNotice: null },
        ],
        footnote: { type: 'returnsToFreePlan', date: new Date('2028-03-12T04:00:00.000Z') },
        primaryAction: 'subscribe',
        endingNotice: null,
      });
    });

    it('B. 보상 중에 보상을 또 받으면 지금 보상, 이어서 받을 보상, 전체 끝을 함께 보인다', () => {
      // When
      const result = receiptOf(PREMIUM_ME_EXAMPLES.rewardDuringReward);

      // Then 남은 기간과 무료 플랜 안내는 전체 끝(3월 11일) 기준이다
      expect(result.rows).toEqual([
        { type: 'rewardPeriod', endsAt: new Date('2028-03-04T04:00:00.000Z') },
        { type: 'bankedReward', days: 7, endsAt: null },
        { type: 'overallPeriod', endsAt: new Date('2028-03-11T04:00:00.000Z') },
        { type: 'daysLeft', days: 10, endingNotice: null },
      ]);
      expect(result.footnote).toEqual({
        type: 'returnsToFreePlan',
        date: new Date('2028-03-11T04:00:00.000Z'),
      });
    });

    it('B. 지금 보상이 내일 끝나도 보상이 이어지면 끝남 안내를 하지 않는다', () => {
      // When
      const result = receiptOf(PREMIUM_ME_EXAMPLES.rewardDuringReward, {
        now: new Date('2028-03-03T03:00:00Z'),
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
        const result = receiptOf(PREMIUM_ME_EXAMPLES.bankedRewardStarted, { now: new Date(now) });

        // Then
        expect(result.rows).toContainEqual({ type: 'daysLeft', days, endingNotice: notice });
        expect(result.endingNotice).toBe(notice);
      },
    );

    it('스토어 결제를 쓸 수 없으면 구독 버튼을 보이지 않는다', () => {
      // When
      const result = receiptOf(PREMIUM_ME_EXAMPLES.newRewardAfterEnded, {
        isStoreConfigured: false,
      });

      // Then
      expect(result.primaryAction).toBeNull();
    });
  });

  describe('관리자', () => {
    it('구독·보상이 없으면 출처 없이 계정 행만 보이고 구독·관리 버튼을 숨긴다', () => {
      // When
      const result = receiptOf(
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
        rows: [{ type: 'account' }],
        footnote: null,
        primaryAction: null,
        endingNotice: null,
      });
    });

    it('초대 보상을 받았으면 보상 기록을 보이지만 끝남 안내는 하지 않는다', () => {
      // When
      const result = receiptOf(
        { ...PREMIUM_ME_EXAMPLES.newRewardAfterEnded, role: 'ADMIN' },
        { now: new Date('2028-03-11T03:00:00Z') },
      );

      // Then
      expect(result.rows).toEqual([
        { type: 'account' },
        { type: 'rewardRecord', endsAt: new Date('2028-03-12T04:00:00.000Z') },
      ]);
      expect(result.endingNotice).toBeNull();
      expect(result.primaryAction).toBeNull();
    });
  });
});
