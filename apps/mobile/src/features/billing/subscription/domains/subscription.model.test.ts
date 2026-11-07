import type { SubscriptionOffering, SubscriptionPlan } from '../schemas/subscription.schema';
import { SubscriptionPolicy } from './subscription.model';

function createPlan(overrides: Partial<SubscriptionPlan>): SubscriptionPlan {
  return {
    identifier: 'monthly',
    planType: 'monthly',
    priceString: '₩8,900',
    price: 8_900,
    currencyCode: 'KRW',
    title: '월간',
    description: null,
    ...overrides,
  };
}

describe('SubscriptionPolicy.getSelectedPlan', () => {
  const monthly = createPlan({ identifier: 'monthly', planType: 'monthly' });
  const annual = createPlan({ identifier: 'annual', planType: 'annual' });
  const offering: SubscriptionOffering = { identifier: 'default', plans: [monthly, annual] };

  test('고르지 않았으면 연간을 고른 것으로 본다', () => {
    // When
    const result = SubscriptionPolicy.getSelectedPlan(offering, undefined);
    // Then
    expect(result).toBe(annual);
  });

  test('연간이 없으면 첫 요금제를 고른 것으로 본다', () => {
    // When
    const result = SubscriptionPolicy.getSelectedPlan({ ...offering, plans: [monthly] }, undefined);
    // Then
    expect(result).toBe(monthly);
  });

  test('고른 요금제가 있으면 그것을 돌려주고 판매에서 빠졌으면 없는 값을 돌려준다', () => {
    // When
    const chosen = SubscriptionPolicy.getSelectedPlan(offering, 'monthly');
    const removed = SubscriptionPolicy.getSelectedPlan(offering, 'old-plan');
    // Then
    expect(chosen).toBe(monthly);
    expect(removed).toBeUndefined();
  });
});

describe('구독 가격 계산', () => {
  test.each([
    [8_900, 68_000, 36],
    [1_000, 12_000, 0],
  ])('월 %s원, 연 %s원의 할인율은 %s%%이다', (monthlyPrice, annualPrice, expected) => {
    // Given
    const prices = { monthlyPrice, annualPrice };
    // When
    const result = SubscriptionPolicy.getAnnualDiscountPercent(
      { price: prices.monthlyPrice },
      { price: prices.annualPrice },
    );
    // Then
    expect(result).toBe(expected);
  });

  test.each([
    [68_000, 5666.67],
    [12_000, 1_000],
    [59.88, 4.99],
    [0.06, 0.01],
    [8.89, 0.74],
  ])('연 %s원의 월 환산 금액은 %s원이다', (annualPrice, expected) => {
    // Given
    const price = annualPrice;
    // When
    const result = SubscriptionPolicy.getMonthlyEquivalent({ price });
    // Then
    expect(result).toBeCloseTo(expected, 2);
  });
});

describe('SubscriptionPolicy.getManagementUrl', () => {
  test.each([
    [
      'android',
      { productId: 'premium_monthly', applicationId: 'com.aido.mobile' },
      'https://play.google.com/store/account/subscriptions?sku=premium_monthly&package=com.aido.mobile',
    ],
    [
      'android',
      { productId: null, applicationId: 'com.aido.mobile' },
      'https://play.google.com/store/account/subscriptions',
    ],
    [
      'android',
      { productId: 'premium_monthly', applicationId: null },
      'https://play.google.com/store/account/subscriptions',
    ],
    [
      'ios',
      { productId: 'premium_monthly', applicationId: 'com.aido.mobile' },
      'https://apps.apple.com/account/subscriptions',
    ],
    ['web', { productId: null, applicationId: null }, null],
  ] as const)('%s %o → %s', (platform, target, url) => {
    expect(SubscriptionPolicy.getManagementUrl(platform, target)).toBe(url);
  });
});
