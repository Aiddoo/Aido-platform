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

const monthly = createPlan({ identifier: 'monthly', planType: 'monthly' });
const annual = createPlan({ identifier: 'annual', planType: 'annual' });
const offering: SubscriptionOffering = { identifier: 'default', plans: [monthly, annual] };

describe('findSelectedPlan', () => {
  it('고르지 않았으면 연간을 고른 것으로 본다', () => {
    // When
    const plan = SubscriptionPolicy.findSelectedPlan(offering, undefined);

    // Then
    expect(plan).toBe(annual);
  });

  it('연간이 없으면 첫 요금제를 고른 것으로 본다', () => {
    // Given
    const monthlyOnly = { ...offering, plans: [monthly] };

    // When
    const plan = SubscriptionPolicy.findSelectedPlan(monthlyOnly, undefined);

    // Then
    expect(plan).toBe(monthly);
  });

  it('고른 요금제가 있으면 그것을 반환한다', () => {
    // When
    const plan = SubscriptionPolicy.findSelectedPlan(offering, 'monthly');

    // Then
    expect(plan).toBe(monthly);
  });

  it('고른 요금제가 판매에서 빠졌으면 없는 값을 반환한다', () => {
    // When
    const plan = SubscriptionPolicy.findSelectedPlan(offering, 'old-plan');

    // Then
    expect(plan).toBeNull();
  });
});

describe('findPlanByType', () => {
  it.each(['monthly', 'annual'] as const)('%s 요금제를 찾아 반환한다', (planType) => {
    // When
    const plan = SubscriptionPolicy.findPlanByType(offering.plans, planType);

    // Then
    expect(plan?.planType).toBe(planType);
  });

  it('그 종류의 요금제가 판매에서 빠졌으면 없는 값을 반환한다', () => {
    // When
    const plan = SubscriptionPolicy.findPlanByType([monthly], 'annual');

    // Then
    expect(plan).toBeNull();
  });
});

describe('getAnnualDiscountPercent', () => {
  it.each([
    [8_900, 68_000, 36],
    [1_000, 12_000, 0],
  ])('월 %i원, 연 %i원의 할인율은 %i%%이다', (monthlyPrice, annualPrice, expected) => {
    // When
    const percent = SubscriptionPolicy.getAnnualDiscountPercent(
      { price: monthlyPrice },
      { price: annualPrice },
    );

    // Then
    expect(percent).toBe(expected);
  });
});

describe('getMonthlyEquivalent', () => {
  it.each([
    [68_000, 5666.67],
    [12_000, 1_000],
    [59.88, 4.99],
    [0.06, 0.01],
    [8.89, 0.74],
  ])('연 %f원의 월 환산 금액은 %f원이다', (annualPrice, expected) => {
    // When
    const monthlyEquivalent = SubscriptionPolicy.getMonthlyEquivalent({ price: annualPrice });

    // Then
    expect(monthlyEquivalent).toBeCloseTo(expected, 2);
  });
});
