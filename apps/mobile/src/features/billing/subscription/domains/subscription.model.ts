import { round } from 'es-toolkit';
import { z } from 'zod';

const planTypeSchema = z.enum(['monthly', 'annual']);
export type PlanType = z.infer<typeof planTypeSchema>;

const subscriptionPlanSchema = z.object({
  identifier: z.string(),
  planType: planTypeSchema,
  priceString: z.string(),
  price: z.number(),
  currencyCode: z.string(),
  title: z.string(),
  description: z.string().nullable(),
});
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

export const subscriptionOfferingSchema = z.object({
  identifier: z.string(),
  plans: z.array(subscriptionPlanSchema),
});
export type SubscriptionOffering = z.infer<typeof subscriptionOfferingSchema>;

/** 월간 결제를 12번 한 값 대비 연간 결제가 얼마나 싼지(%) */
function getAnnualDiscountPercent(
  monthlyPlan: Pick<SubscriptionPlan, 'price'>,
  annualPlan: Pick<SubscriptionPlan, 'price'>,
) {
  return Math.round((1 - annualPlan.price / (monthlyPlan.price * 12)) * 100);
}

function getMonthlyEquivalent(annualPlan: Pick<SubscriptionPlan, 'price'>) {
  return round(annualPlan.price / 12, 2);
}

function findSelectedPlan(offering: SubscriptionOffering, chosenPlanId: string | undefined) {
  if (chosenPlanId != null) {
    return offering.plans.find((plan) => plan.identifier === chosenPlanId) ?? null;
  }
  return findPlanByType(offering.plans, 'annual') ?? offering.plans[0] ?? null;
}

function findPlanByType(
  plans: readonly SubscriptionPlan[],
  planType: SubscriptionPlan['planType'],
) {
  return plans.find((plan) => plan.planType === planType) ?? null;
}

export const SubscriptionPolicy = {
  getAnnualDiscountPercent,
  getMonthlyEquivalent,
  findSelectedPlan,
  findPlanByType,
} as const;
