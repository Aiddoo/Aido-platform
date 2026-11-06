import { match } from 'ts-pattern';

import {
  APP_STORE_SUBSCRIPTIONS_URL,
  PLAY_STORE_SUBSCRIPTIONS_URL,
} from '../constants/subscription.constants';
import type { SubscriptionOffering } from '../schemas/subscription.schema';

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
function getManagementUrl(
  platform: string,
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
