import { PREMIUM_TRIAL_ENDING_NOTICE_DAYS } from '@aido/api/vocabulary';
import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  diffDateKeysInDays,
} from '@src/shared/date/date-key';
import { round } from 'es-toolkit';
import { match } from 'ts-pattern';
import { z } from 'zod';

const planTypeSchema = z.enum(['monthly', 'annual']);
export type PlanType = z.infer<typeof planTypeSchema>;

const MONTHS_PER_YEAR = 12;

const freeTrialSchema = z.object({
  periodUnit: z.enum(['day', 'week', 'month', 'year']),
  periodNumberOfUnits: z.int().positive(),
});
export type FreeTrial = z.infer<typeof freeTrialSchema>;

const subscriptionPlanSchema = z.object({
  identifier: z.string(),
  planType: planTypeSchema,
  priceString: z.string(),
  price: z.number(),
  currencyCode: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  /** 스토어가 이 사용자에게 줄 수 있다고 한 무료 체험. 자격이 없으면 null이다 */
  freeTrial: freeTrialSchema.nullable(),
});
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

export const subscriptionOfferingSchema = z.object({
  identifier: z.string(),
  plans: z.array(subscriptionPlanSchema),
});
export type SubscriptionOffering = z.infer<typeof subscriptionOfferingSchema>;

/** 월간 결제를 12번 한 값 대비 연간 결제가 얼마나 싼지(%) */
function getAnnualDiscountPercent(monthlyPlan: SubscriptionPlan, annualPlan: SubscriptionPlan) {
  return Math.round((1 - annualPlan.price / (monthlyPlan.price * 12)) * 100);
}

function getMonthlyEquivalent(annualPlan: SubscriptionPlan) {
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

export function hasFreeTrial(freeTrial: FreeTrial | null) {
  return freeTrial != null;
}

/** 결제 전 예상일이다. 실제 체험 끝은 결제 뒤 서버(premiumPeriodEndsAt)가 알려 준다. 월 단위는 말일을 넘기면 그 달 마지막 날로 맞춘다 */
function getFreeTrialEndDateKey(plan: SubscriptionPlan, todayKey: string) {
  if (plan.freeTrial == null) {
    return null;
  }
  const { periodUnit, periodNumberOfUnits } = plan.freeTrial;
  return match(periodUnit)
    .with('day', () => addDaysToDateKey(todayKey, periodNumberOfUnits))
    .with('week', () => addDaysToDateKey(todayKey, periodNumberOfUnits * DAYS_PER_WEEK))
    .with('month', () => addMonthsToDateKey(todayKey, periodNumberOfUnits))
    .with('year', () => addMonthsToDateKey(todayKey, periodNumberOfUnits * MONTHS_PER_YEAR))
    .exhaustive();
}

/** 서버가 체험 끝 N일 전에 한 번 알린다. 체험이 그보다 짧아 오늘이거나 지난 날이면 알림이 없다 */
function getFreeTrialReminderDateKey(plan: SubscriptionPlan, todayKey: string) {
  const endDateKey = getFreeTrialEndDateKey(plan, todayKey);
  if (endDateKey == null) {
    return null;
  }
  const reminderDateKey = addDaysToDateKey(endDateKey, -PREMIUM_TRIAL_ENDING_NOTICE_DAYS);
  return diffDateKeysInDays(todayKey, reminderDateKey) > 0 ? reminderDateKey : null;
}

/** 체험을 받을 수 있으면 오늘은 결제되지 않고, 아니면 고른 요금제 가격이 바로 결제된다 */
function getAmountDueToday(plan: SubscriptionPlan) {
  return plan.freeTrial == null ? plan.price : 0;
}

export const SubscriptionPolicy = {
  getAnnualDiscountPercent,
  getMonthlyEquivalent,
  findSelectedPlan,
  findPlanByType,
  getFreeTrialEndDateKey,
  getFreeTrialReminderDateKey,
  getAmountDueToday,
} as const;
