import { type PlanType } from '@src/shared/domains/plan-type.model';
import { z } from 'zod';

import { type SubscriptionPlan, subscriptionPlanSchema } from './subscription.model';

/** 스토어가 지금 이 사용자에게 파는 요금제 묶음 */
export const subscriptionOfferingSchema = z.object({
  identifier: z.string(),
  plans: z.array(subscriptionPlanSchema),
});
export type SubscriptionOffering = z.infer<typeof subscriptionOfferingSchema>;

export const SubscriptionOfferingPolicy = {
  findPlanByType(offering: SubscriptionOffering, planType: PlanType): SubscriptionPlan | null {
    return offering.plans.find((plan) => plan.planType === planType) ?? null;
  },

  /** 고르지 않았으면 연간, 연간이 없으면 첫 요금제다. 고른 요금제가 판매에서 빠졌으면 null이다 */
  findSelectedPlan(
    offering: SubscriptionOffering,
    chosenPlanId: string | undefined,
  ): SubscriptionPlan | null {
    if (chosenPlanId != null) {
      return offering.plans.find((plan) => plan.identifier === chosenPlanId) ?? null;
    }
    return this.findPlanByType(offering, 'annual') ?? offering.plans[0] ?? null;
  },
};
