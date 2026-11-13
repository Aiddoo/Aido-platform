import type { PlanType } from '@src/shared/domains/plan-type.model';

import type { FreeTrial } from '../domains/subscription.model';

const PLAN_NAME_KEYS = {
  annual: 'plan.annual',
  monthly: 'plan.monthly',
} as const satisfies Record<PlanType, string>;

const PLAN_PRICE_LABEL_KEYS = {
  annual: 'plan.pricePerYear',
  monthly: 'plan.pricePerMonth',
} as const satisfies Record<PlanType, string>;

const FREE_TRIAL_PERIOD_LABEL_KEYS = {
  day: 'trialPeriod.day',
  week: 'trialPeriod.week',
  month: 'trialPeriod.month',
  year: 'trialPeriod.year',
} as const satisfies Record<FreeTrial['periodUnit'], string>;

export function getPlanNameKey(planType: PlanType) {
  return PLAN_NAME_KEYS[planType];
}

/** 체험 뒤 실제로 청구되는 금액과 주기. 가장 큰 가격과 같은 스토어 가격 문자열을 쓴다(App Store 3.1.2) */
export function getPlanPriceLabelKey(planType: PlanType) {
  return PLAN_PRICE_LABEL_KEYS[planType];
}

export function getFreeTrialPeriodLabelKey(periodUnit: FreeTrial['periodUnit']) {
  return FREE_TRIAL_PERIOD_LABEL_KEYS[periodUnit];
}
