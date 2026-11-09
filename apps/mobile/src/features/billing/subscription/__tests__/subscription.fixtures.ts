import type { SubscriptionPlan } from '../domains/subscription.model';

const DEFAULT_PLAN: SubscriptionPlan = {
  identifier: 'annual',
  planType: 'annual',
  priceString: '₩29,900',
  price: 29_900,
  currencyCode: 'KRW',
  title: '연간',
  description: null,
  freeTrial: { periodUnit: 'month', periodNumberOfUnits: 1 },
};

export function createSubscriptionPlan(
  overrides: Partial<SubscriptionPlan> = {},
): SubscriptionPlan {
  return { ...DEFAULT_PLAN, ...overrides };
}
