import { z } from 'zod';

export const planTypeSchema = z.enum(['monthly', 'annual']);
export type PlanType = z.infer<typeof planTypeSchema>;

export const subscriptionPlanSchema = z.object({
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

/** Subscription 도메인 비즈니스 규칙 */
export const SubscriptionPolicy = {
  /** 연간 할인율 계산 (%) */
  getAnnualDiscountPercent(monthlyPrice: number, annualPrice: number): number {
    return Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100);
  },

  /** 연간 가격의 월 환산 가격 */
  getMonthlyEquivalent(annualPrice: number): number {
    return Math.round((annualPrice / 12) * 100) / 100;
  },

  /** 통화 코드에 맞게 금액을 포맷 (예: ₩8,250, $6.67) */
  formatPrice(amount: number, currencyCode: string): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: currencyCode === 'KRW' || currencyCode === 'JPY' ? 0 : 2,
    }).format(amount);
  },
} as const;
