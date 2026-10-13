import {
  getAnnualDiscountPercent,
  getMonthlyEquivalent,
  isActiveSubscription,
  isCancelledSubscription,
  SubscriptionPolicy,
} from './subscription.model';

describe('구독 상태와 가격 계산', () => {
  test.each(['ACTIVE', 'FREE', 'EXPIRED', 'CANCELLED'] as const)(
    '%s 구독 상태를 판정한다',
    (status) => {
      // Given
      const subscriptionStatus = status;
      // When
      const active = isActiveSubscription(subscriptionStatus);
      const cancelled = isCancelledSubscription(subscriptionStatus);
      // Then
      expect(active).toBe(status === 'ACTIVE');
      expect(cancelled).toBe(status === 'CANCELLED');
    },
  );

  test.each([
    [8_900, 68_000, 36],
    [1_000, 12_000, 0],
  ])('월 %s원, 연 %s원의 할인율은 %s%%이다', (monthlyPrice, annualPrice, expected) => {
    // Given
    const prices = { monthlyPrice, annualPrice };
    // When
    const result = getAnnualDiscountPercent(prices.monthlyPrice, prices.annualPrice);
    // Then
    expect(result).toBe(expected);
  });

  test.each([
    [68_000, 5666.67],
    [12_000, 1_000],
  ])('연 %s원의 월 환산 금액은 %s원이다', (annualPrice, expected) => {
    // Given
    const price = annualPrice;
    // When
    const result = getMonthlyEquivalent(price);
    // Then
    expect(result).toBeCloseTo(expected, 2);
  });

  test.each(['ACTIVE', 'CANCELLED', 'FREE', 'EXPIRED'] as const)(
    '%s 상태와 만료일을 함께 판정한다',
    (subscriptionStatus) => {
      // Given
      const user = { subscriptionStatus, subscriptionExpiresAt: new Date('2026-04-01T00:00:00Z') };
      // When
      const result = SubscriptionPolicy.isExpirationRelevant(user);
      const withoutDate = SubscriptionPolicy.isExpirationRelevant({
        ...user,
        subscriptionExpiresAt: null,
      });
      // Then
      expect(result).toBe(subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'CANCELLED');
      expect(withoutDate).toBe(false);
    },
  );
});
