import {
  type SubscriptionOffering,
  SubscriptionOfferingPolicy,
} from './subscription-offering.model';
import { type SubscriptionPlan } from './subscription.model';

function createPlan(overrides: Partial<SubscriptionPlan>): SubscriptionPlan {
  return {
    identifier: 'monthly',
    planType: 'monthly',
    priceString: '₩8,900',
    price: 8_900,
    currencyCode: 'KRW',
    title: '월간',
    description: null,
    freeTrial: null,
    ...overrides,
  };
}

const monthly = createPlan({ identifier: 'monthly', planType: 'monthly' });
const annual = createPlan({ identifier: 'annual', planType: 'annual' });
const offering: SubscriptionOffering = { identifier: 'default', plans: [monthly, annual] };

describe('SubscriptionOfferingPolicy', () => {
  describe('findSelectedPlan', () => {
    it('고르지 않았으면 연간을 고른 것으로 본다', () => {
      // When
      const plan = SubscriptionOfferingPolicy.findSelectedPlan(offering, undefined);

      // Then
      expect(plan).toBe(annual);
    });

    it('연간이 없으면 첫 요금제를 고른 것으로 본다', () => {
      // Given
      const monthlyOnly = { ...offering, plans: [monthly] };

      // When
      const plan = SubscriptionOfferingPolicy.findSelectedPlan(monthlyOnly, undefined);

      // Then
      expect(plan).toBe(monthly);
    });

    it('고른 요금제가 있으면 그것을 반환한다', () => {
      // When
      const plan = SubscriptionOfferingPolicy.findSelectedPlan(offering, 'monthly');

      // Then
      expect(plan).toBe(monthly);
    });

    it('고른 요금제가 판매에서 빠졌으면 없는 값을 반환한다', () => {
      // When
      const plan = SubscriptionOfferingPolicy.findSelectedPlan(offering, 'old-plan');

      // Then
      expect(plan).toBeNull();
    });
  });

  describe('findPlanByType', () => {
    it.each(['monthly', 'annual'] as const)('%s 요금제를 찾아 반환한다', (planType) => {
      // When
      const plan = SubscriptionOfferingPolicy.findPlanByType(offering, planType);

      // Then
      expect(plan?.planType).toBe(planType);
    });

    it('그 종류의 요금제가 판매에서 빠졌으면 없는 값을 반환한다', () => {
      // When
      const plan = SubscriptionOfferingPolicy.findPlanByType(
        { ...offering, plans: [monthly] },
        'annual',
      );

      // Then
      expect(plan).toBeNull();
    });
  });
});
