import type { User } from '@src/features/user/domains/user.model';

import { createPremiumAccess } from '../../__tests__/premium-access.factories';
import type { PremiumAccess } from '../../domains/premium-access.model';
import { toSubscriptionReceiptViewModel } from './subscription-receipt.view-model';

const SEOUL = 'Asia/Seoul';
// 10월 25일 12:00 KST
const NOW = new Date('2026-10-25T03:00:00Z');
// 11월 1일 14:30 KST
const NOV_1 = new Date('2026-11-01T05:30:00Z');
const NOV_8 = new Date('2026-11-08T05:30:00Z');
const NOV_12 = new Date('2026-11-12T05:30:00Z');
const NOV_19 = new Date('2026-11-19T05:30:00Z');

interface ReceiptOptions {
  role?: User['role'];
  isStoreConfigured?: boolean;
  now?: Date;
}

function receiptOf(
  access: Partial<PremiumAccess>,
  { role = 'USER', isStoreConfigured = true, now = NOW }: ReceiptOptions = {},
) {
  return toSubscriptionReceiptViewModel(
    { role, premiumAccess: createPremiumAccess(access) },
    { isStoreConfigured, now, timeZone: SEOUL },
  );
}

describe('toSubscriptionReceiptViewModel', () => {
  describe('스토어 구독', () => {
    it('자동 갱신 중이면 다음 결제일과 자동 갱신을 보이고 스토어 설정 안내를 붙인다', () => {
      // When
      const result = receiptOf({
        source: 'STORE',
        endsAt: NOV_12,
        periodEndsAt: NOV_12,
        willRenew: true,
      });

      // Then
      expect(result).toEqual({
        variant: 'paid',
        rows: [
          { type: 'nextBillingDate', date: NOV_12 },
          { type: 'autoRenewal', willRenew: true },
        ],
        footnote: { type: 'manageAutoRenewalInStore' },
        primaryAction: 'manage',
        endingNotice: null,
      });
    });

    it('취소했으면 결제일 대신 구독 종료일을 보이고 무료 플랜으로 돌아가는 날을 안내한다', () => {
      // When
      const result = receiptOf({
        source: 'STORE',
        endsAt: NOV_12,
        periodEndsAt: NOV_12,
        willRenew: false,
      });

      // Then
      expect(result).toEqual({
        variant: 'paid',
        rows: [
          { type: 'subscriptionEndsOn', date: NOV_12 },
          { type: 'autoRenewal', willRenew: false },
        ],
        footnote: { type: 'returnsToFreePlan', date: NOV_12 },
        primaryAction: 'manage',
        endingNotice: null,
      });
    });

    it('취소했고 끝나기 하루 전이면 끝남 안내를 tomorrow로 반환한다', () => {
      // When
      const result = receiptOf(
        { source: 'STORE', endsAt: NOV_12, periodEndsAt: NOV_12, willRenew: false },
        { now: new Date('2026-11-11T03:00:00Z') },
      );

      // Then
      expect(result.endingNotice).toBe('tomorrow');
    });

    it.each([
      ['A. 보상 기간 중 구독을 시작해 남은 보상이 미뤄졌으면', true],
      ['C. 구독 중에 보상을 받았으면', true],
      ['E. 구독을 취소했고 보상이 이어지면', false],
    ])('%s 이어서 받을 보상과 전체 끝을 보이고 보상이 이어진다고 안내한다', (_case, willRenew) => {
      // When
      const result = receiptOf({
        source: 'STORE',
        endsAt: NOV_19,
        periodEndsAt: NOV_12,
        willRenew,
        bankedDays: 7,
      });

      // Then
      expect(result.rows).toEqual([
        willRenew
          ? { type: 'nextBillingDate', date: NOV_12 }
          : { type: 'subscriptionEndsOn', date: NOV_12 },
        { type: 'autoRenewal', willRenew },
        { type: 'bankedReward', days: 7, endsAt: NOV_19 },
      ]);
      expect(result.footnote).toEqual({ type: 'rewardStartsAfterSubscription', days: 7 });
    });

    it('E. 취소한 구독이 내일 끝나도 보상이 이어지면 끝남 안내를 하지 않는다', () => {
      // When
      const result = receiptOf(
        { source: 'STORE', endsAt: NOV_19, periodEndsAt: NOV_12, willRenew: false, bankedDays: 7 },
        { now: new Date('2026-11-11T03:00:00Z') },
      );

      // Then
      expect(result.endingNotice).toBeNull();
    });

    it('구버전 서버라 출처가 없으면 날짜 행 없이 구독 관리만 보인다', () => {
      // When
      const result = receiptOf({ source: null, endsAt: null, periodEndsAt: null });

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
    it('이용 기간과 남은 일수를 보이고 무료 플랜으로 돌아가는 날을 안내한다', () => {
      // When
      const result = receiptOf({ source: 'GRANT', endsAt: NOV_1, periodEndsAt: NOV_1 });

      // Then 결제 용어(다음 결제일·자동 갱신) 행이 없다
      expect(result).toEqual({
        variant: 'reward',
        rows: [
          { type: 'rewardPeriod', endsAt: NOV_1 },
          { type: 'daysLeft', days: 7, endingNotice: null },
        ],
        footnote: { type: 'returnsToFreePlan', date: NOV_1 },
        primaryAction: 'subscribe',
        endingNotice: null,
      });
    });

    it('스토어 결제를 쓸 수 없으면 구독 버튼을 보이지 않는다', () => {
      // When
      const result = receiptOf(
        { source: 'GRANT', endsAt: NOV_1, periodEndsAt: NOV_1 },
        { isStoreConfigured: false },
      );

      // Then
      expect(result.primaryAction).toBeNull();
    });

    it.each([
      ['하루 전', '2026-10-31T03:00:00Z', 1, 'tomorrow'],
      ['마지막 날', '2026-11-01T01:00:00Z', 0, 'today'],
    ] as const)('%s이면 남은 기간 행과 끝남 안내에 %s를 담는다', (_case, now, days, notice) => {
      // When
      const result = receiptOf(
        { source: 'GRANT', endsAt: NOV_1, periodEndsAt: NOV_1 },
        { now: new Date(now) },
      );

      // Then
      expect(result.rows).toContainEqual({ type: 'daysLeft', days, endingNotice: notice });
      expect(result.endingNotice).toBe(notice);
    });

    it('B. 보상 중에 보상을 또 받으면 지금 기간, 이어서 받을 보상, 전체 끝을 함께 보인다', () => {
      // When
      const result = receiptOf({
        source: 'GRANT',
        endsAt: NOV_8,
        periodEndsAt: NOV_1,
        bankedDays: 7,
      });

      // Then 남은 기간과 무료 플랜 안내는 전체 끝(11월 8일) 기준이다
      expect(result.rows).toEqual([
        { type: 'rewardPeriod', endsAt: NOV_1 },
        { type: 'bankedReward', days: 7, endsAt: null },
        { type: 'overallPeriod', endsAt: NOV_8 },
        { type: 'daysLeft', days: 14, endingNotice: null },
      ]);
      expect(result.footnote).toEqual({ type: 'returnsToFreePlan', date: NOV_8 });
    });

    it('B. 지금 기간이 내일 끝나도 보상이 이어지면 끝남 안내를 하지 않는다', () => {
      // When
      const result = receiptOf(
        { source: 'GRANT', endsAt: NOV_8, periodEndsAt: NOV_1, bankedDays: 7 },
        { now: new Date('2026-10-31T03:00:00Z') },
      );

      // Then
      expect(result.endingNotice).toBeNull();
    });
  });

  describe('관리자', () => {
    it('구독·보상이 없으면 계정 행만 보이고 구독·관리 버튼을 숨긴다', () => {
      // When
      const result = receiptOf(
        { source: null, endsAt: null, periodEndsAt: null },
        { role: 'ADMIN' },
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
        { source: 'GRANT', endsAt: NOV_1, periodEndsAt: NOV_1 },
        { role: 'ADMIN', now: new Date('2026-10-31T03:00:00Z') },
      );

      // Then
      expect(result.rows).toEqual([{ type: 'account' }, { type: 'rewardRecord', endsAt: NOV_1 }]);
      expect(result.endingNotice).toBeNull();
      expect(result.primaryAction).toBeNull();
    });
  });
});
