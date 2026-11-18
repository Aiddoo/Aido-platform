import { defineFixture } from '@src/testing/fixture';

import { subscriptionPlanSchema } from '../domains/subscription.model';

export const createSubscriptionPlan = defineFixture(subscriptionPlanSchema, {
  identifier: 'annual',
  planType: 'annual',
  priceString: '₩29,900',
  price: 29_900,
  currencyCode: 'KRW',
  title: '연간',
  description: null,
  freeTrial: { periodUnit: 'week', periodNumberOfUnits: 2 },
});
