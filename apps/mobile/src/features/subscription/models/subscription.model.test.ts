import {
  getAnnualDiscountPercent,
  getMonthlyEquivalent,
  isActiveSubscription,
  isCancelledSubscription,
  SubscriptionPolicy,
} from './subscription.model';

describe('isActiveSubscription', () => {
  test('ACTIVE 상태이면 true를 반환한다', () => {
    expect(isActiveSubscription('ACTIVE')).toBe(true);
  });

  test.each(['FREE', 'EXPIRED', 'CANCELLED'] as const)('%s 상태이면 false를 반환한다', (status) => {
    expect(isActiveSubscription(status)).toBe(false);
  });
});

describe('isCancelledSubscription', () => {
  test('CANCELLED 상태이면 true를 반환한다', () => {
    expect(isCancelledSubscription('CANCELLED')).toBe(true);
  });

  test.each(['FREE', 'EXPIRED', 'ACTIVE'] as const)('%s 상태이면 false를 반환한다', (status) => {
    expect(isCancelledSubscription(status)).toBe(false);
  });
});

describe('getAnnualDiscountPercent', () => {
  test('월간 8,900원, 연간 68,000원이면 36% 할인율을 반환한다', () => {
    expect(getAnnualDiscountPercent(8_900, 68_000)).toBe(36);
  });

  test('월간과 연간 가격이 같으면 0%를 반환한다', () => {
    expect(getAnnualDiscountPercent(1_000, 12_000)).toBe(0);
  });
});

describe('getMonthlyEquivalent', () => {
  test('연간 68,000원이면 월 5,666.67원을 반환한다', () => {
    expect(getMonthlyEquivalent(68_000)).toBeCloseTo(5666.67, 2);
  });

  test('연간 12,000원이면 월 1,000원을 반환한다', () => {
    expect(getMonthlyEquivalent(12_000)).toBe(1_000);
  });
});

describe('SubscriptionPolicy', () => {
  describe('shouldShowExpirationDetails', () => {
    const expiresAt = new Date('2026-04-01');

    test('ACTIVE 상태이고 만료일이 있으면 true를 반환한다', () => {
      expect(SubscriptionPolicy.shouldShowExpirationDetails('ACTIVE', expiresAt)).toBe(true);
    });

    test('CANCELLED 상태이고 만료일이 있으면 true를 반환한다', () => {
      expect(SubscriptionPolicy.shouldShowExpirationDetails('CANCELLED', expiresAt)).toBe(true);
    });

    test('ACTIVE 상태이지만 만료일이 없으면 false를 반환한다', () => {
      expect(SubscriptionPolicy.shouldShowExpirationDetails('ACTIVE', null)).toBe(false);
    });

    test.each(['FREE', 'EXPIRED'] as const)(
      '%s 상태이면 만료일이 있어도 false를 반환한다',
      (status) => {
        expect(SubscriptionPolicy.shouldShowExpirationDetails(status, expiresAt)).toBe(false);
      },
    );
  });
});
