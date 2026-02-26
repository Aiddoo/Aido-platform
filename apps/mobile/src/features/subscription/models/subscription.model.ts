import type { SubscriptionStatus } from '@src/features/user/models/user.model';
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

// Filters & Predicates

export function isActiveSubscription(status: SubscriptionStatus) {
  return status === 'ACTIVE';
}

export function isCancelledSubscription(status: SubscriptionStatus) {
  return status === 'CANCELLED';
}

// Calculations

export function getAnnualDiscountPercent(monthlyPrice: number, annualPrice: number) {
  return Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100);
}

export function getMonthlyEquivalent(annualPrice: number) {
  return Math.round((annualPrice / 12) * 100) / 100;
}

export function formatPrice(amount: number, currencyCode: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: currencyCode === 'KRW' || currencyCode === 'JPY' ? 0 : 2,
  }).format(amount);
}

// Policy (Business Logic)

export const SubscriptionPolicy = {
  shouldShowExpirationDetails(
    status: SubscriptionStatus,
    expiresAt: Date | null,
  ): expiresAt is Date {
    return (isActiveSubscription(status) || isCancelledSubscription(status)) && expiresAt !== null;
  },
} as const;
