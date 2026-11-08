import { match } from 'ts-pattern';

import {
  APP_STORE_SUBSCRIPTIONS_URL,
  PLAY_STORE_SUBSCRIPTIONS_URL,
} from '../constants/subscription.constants';

interface SubscriptionManagementTarget {
  productId: string | null;
  /** Android 패키지 이름 */
  applicationId: string | null;
}

/** Android는 상품 id를 알면 그 구독 페이지를, 모르면 구독 목록을 연다. 스토어가 없는 플랫폼은 null이다 */
export function createManagementUrl(
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
