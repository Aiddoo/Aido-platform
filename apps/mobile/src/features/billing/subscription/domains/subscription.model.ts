import { PREMIUM_TRIAL_ENDING_NOTICE_DAYS } from '@aido/api/vocabulary';
import { DAYS_PER_WEEK, MONTHS_PER_YEAR } from '@src/shared/constants/time-units';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  diffDateKeysInDays,
  type DateKey,
} from '@src/shared/date/date-key';
import { planTypeSchema } from '@src/shared/domains/plan-type.model';
import { round } from 'es-toolkit';
import { match } from 'ts-pattern';
import { z } from 'zod';

const freeTrialSchema = z.object({
  periodUnit: z.enum(['day', 'week', 'month', 'year']),
  periodNumberOfUnits: z.int().positive(),
});
export type FreeTrial = z.infer<typeof freeTrialSchema>;

export const subscriptionPlanSchema = z.object({
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

export const SubscriptionPolicy = {
  hasFreeTrial(plan: SubscriptionPlan): boolean {
    return plan.freeTrial != null;
  },

  /** 월간 결제를 12번 한 값 대비 연간 결제가 얼마나 싼지(%) */
  getAnnualDiscountPercent(monthlyPlan: SubscriptionPlan, annualPlan: SubscriptionPlan): number {
    return Math.round((1 - annualPlan.price / (monthlyPlan.price * MONTHS_PER_YEAR)) * 100);
  },

  getMonthlyEquivalent(annualPlan: SubscriptionPlan): number {
    return round(annualPlan.price / MONTHS_PER_YEAR, 2);
  },

  /** 결제 전 예상일이다. 실제 체험 끝은 결제 뒤 서버(premiumPeriodEndsAt)가 알려 준다. 월 단위는 말일을 넘기면 그 달 마지막 날로 맞춘다 */
  findFreeTrialEndDateKey(plan: SubscriptionPlan, todayKey: DateKey): DateKey | null {
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
  },

  /** 서버가 체험 끝 N일 전에 한 번 알린다. 체험이 그보다 짧아 오늘이거나 지난 날이면 알림이 없다 */
  findFreeTrialReminderDateKey(plan: SubscriptionPlan, todayKey: DateKey): DateKey | null {
    const endDateKey = this.findFreeTrialEndDateKey(plan, todayKey);
    if (endDateKey == null) {
      return null;
    }
    const reminderDateKey = addDaysToDateKey(endDateKey, -PREMIUM_TRIAL_ENDING_NOTICE_DAYS);
    return diffDateKeysInDays(todayKey, reminderDateKey) > 0 ? reminderDateKey : null;
  },

  /** 체험을 받을 수 있으면 오늘은 결제되지 않고, 아니면 고른 요금제 가격이 바로 결제된다 */
  getAmountDueToday(plan: SubscriptionPlan): number {
    return plan.freeTrial == null ? plan.price : 0;
  },
};
