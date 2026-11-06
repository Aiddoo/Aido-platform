import type { PlatformOSType } from 'react-native';
import { match } from 'ts-pattern';
import { z } from 'zod';

import {
  APP_STORE_SUBSCRIPTIONS_URL,
  PLAY_STORE_SUBSCRIPTIONS_URL,
} from '../constants/subscription.constants';

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

const subscriptionOfferingSchema = z.object({
  identifier: z.string(),
  plans: z.array(subscriptionPlanSchema),
});
export type SubscriptionOffering = z.infer<typeof subscriptionOfferingSchema>;

export function getAnnualDiscountPercent(monthlyPrice: number, annualPrice: number) {
  return Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100);
}

export function getMonthlyEquivalent(annualPrice: number) {
  return Math.round((annualPrice / 12) * 100) / 100;
}

export function getSelectedPlan(offering: SubscriptionOffering, chosenPlanId: string | undefined) {
  if (chosenPlanId != null) {
    return offering.plans.find((plan) => plan.identifier === chosenPlanId);
  }
  return offering.plans.find((plan) => plan.planType === 'annual') ?? offering.plans[0];
}

interface SubscriptionManagementTarget {
  /** 스토어에서 결제한 활성 구독 상품 id */
  productId: string | null;
  /** Android 패키지 이름 */
  applicationId: string | null;
}

/**
 * 스토어의 구독 관리 주소. Android는 상품 id를 알면 그 구독 페이지를, 모르면 구독 목록을 연다.
 * 스토어가 없는 플랫폼은 null이다.
 */
export function getManagementUrl(
  platform: PlatformOSType,
  { productId, applicationId }: SubscriptionManagementTarget,
): string | null {
  return match(platform)
    .with('ios', () => APP_STORE_SUBSCRIPTIONS_URL)
    .with('android', () => {
      if (productId == null || applicationId == null) {
        return PLAY_STORE_SUBSCRIPTIONS_URL;
      }
      const query = new URLSearchParams({ sku: productId, package: applicationId });
      return `${PLAY_STORE_SUBSCRIPTIONS_URL}?${query.toString()}`;
    })
    .otherwise(() => null);
}

export const SubscriptionPolicy = {
  getManagementUrl,
} as const;
