import { round } from 'es-toolkit';

import type { SubscriptionOffering, SubscriptionPlan } from '../schemas/subscription.schema';

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

function getSelectedPlan(offering: SubscriptionOffering, chosenPlanId: string | undefined) {
  if (chosenPlanId != null) {
    return offering.plans.find((plan) => plan.identifier === chosenPlanId);
  }
  return findPlanByType(offering.plans, 'annual') ?? offering.plans[0];
}

function findPlanByType(
  plans: readonly SubscriptionPlan[],
  planType: SubscriptionPlan['planType'],
) {
  return plans.find((plan) => plan.planType === planType);
}

export const SubscriptionPolicy = {
  getAnnualDiscountPercent,
  getMonthlyEquivalent,
  getSelectedPlan,
  findPlanByType,
} as const;
