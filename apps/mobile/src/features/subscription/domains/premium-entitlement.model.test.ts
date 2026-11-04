import { createPremiumEntitlements } from '../__tests__/premium-entitlement.factories';
import { PremiumEntitlementPolicy } from './premium-entitlement.model';

const SEOUL = 'Asia/Seoul';
const LOS_ANGELES = 'America/Los_Angeles';

describe('PremiumEntitlementPolicy', () => {
  describe('limit', () => {
    it('서버가 준 한도를 쓴다', () => {
      // Given 초대로 친구 자리가 하나 늘었다
      const subject = {
        entitlements: createPremiumEntitlements({ FRIEND: { allowed: true, limit: 6 } }),
      };

      // When / Then
      expect(PremiumEntitlementPolicy.limit(subject, 'FRIEND')).toBe(6);
    });
  });

  describe('freeLimit', () => {
    it('무료 사용자는 늘어난 자리를 반영한 서버 한도를 안내한다', () => {
      // Given
      const subject = {
        entitlements: createPremiumEntitlements({ FRIEND: { allowed: true, limit: 7 } }),
        isPremium: false,
      };

      // When / Then
      expect(PremiumEntitlementPolicy.freeLimit(subject, 'FRIEND')).toBe(7);
    });

    it('프리미엄 사용자는 무제한이라 카탈로그의 무료 한도를 안내한다', () => {
      // Given
      const subject = {
        entitlements: createPremiumEntitlements({ FRIEND: { allowed: true, limit: null } }),
        isPremium: true,
      };

      // When / Then
      expect(PremiumEntitlementPolicy.freeLimit(subject, 'FRIEND')).toBe(5);
    });
  });

  describe('resetNotice', () => {
    it('하루 횟수는 다음 자정이 내일이라 내일 다시 쓸 수 있다', () => {
      // Given 서울 11월 1일 23:00, 초기화는 11월 2일 00:00 KST
      const quota = { limit: 3, resetsAt: new Date('2026-11-01T15:00:00Z') };

      // When
      const notice = PremiumEntitlementPolicy.resetNotice(
        quota,
        new Date('2026-11-01T14:00:00Z'),
        SEOUL,
      );

      // Then
      expect(notice).toEqual({ type: 'tomorrow' });
    });

    it('한 달 횟수는 초기화 날짜를 알린다', () => {
      // Given 서울 11월 10일, 초기화는 12월 1일 00:00 KST
      const resetsAt = new Date('2026-11-30T15:00:00Z');

      // When
      const notice = PremiumEntitlementPolicy.resetNotice(
        { limit: 5, resetsAt },
        new Date('2026-11-10T03:00:00Z'),
        SEOUL,
      );

      // Then
      expect(notice).toEqual({ type: 'date', date: resetsAt });
    });

    it('KST 기준 월초 초기화가 다른 시간대에서 오늘 안이면 오늘이다', () => {
      // Given LA 11월 30일 07:00 PST = 12월 1일 00:00 KST, 지금은 LA 11월 30일 01:00
      const quota = { limit: 5, resetsAt: new Date('2026-11-30T15:00:00Z') };

      // When
      const notice = PremiumEntitlementPolicy.resetNotice(
        quota,
        new Date('2026-11-30T09:00:00Z'),
        LOS_ANGELES,
      );

      // Then
      expect(notice).toEqual({ type: 'today' });
    });

    it.each([
      ['무제한', { limit: null, resetsAt: new Date('2026-11-02T15:00:00Z') }],
      ['초기화 시각 없음', { limit: 3, resetsAt: undefined }],
      [
        '오래된 내 정보의 지난 초기화 시각',
        { limit: 3, resetsAt: new Date('2026-10-31T15:00:00Z') },
      ],
    ] as const)('%s이면 안내하지 않는다', (_case, quota) => {
      // Given / When
      const notice = PremiumEntitlementPolicy.resetNotice(
        quota,
        new Date('2026-11-01T14:00:00Z'),
        SEOUL,
      );

      // Then
      expect(notice).toBeNull();
    });
  });
});
