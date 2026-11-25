import type { PlatformOSType } from 'react-native';
import { match } from 'ts-pattern';

import {
  APP_STORE_SUBSCRIPTIONS_URL,
  PLAY_STORE_SUBSCRIPTIONS_URL,
} from '../constants/subscription.constants';

export type RenewalNoticeStore = 'appStore' | 'googlePlay';

/** 구독 결제·해지를 맡는 스토어. 인앱 구독이 없는 플랫폼은 null이다. */
export function findSubscriptionStore(os: PlatformOSType): RenewalNoticeStore | null {
  return match(os)
    .returnType<RenewalNoticeStore | null>()
    .with('ios', 'macos', () => 'appStore')
    .with('android', () => 'googlePlay')
    .with('web', 'windows', 'native', () => null)
    .exhaustive();
}

interface SubscriptionManagementTarget {
  productId: string | null;
  /** Android 패키지 이름 */
  applicationId: string | null;
}

/** 스토어가 주소를 주지 않을 때 열 구독 관리 주소. Android는 상품 id를 알면 그 구독 페이지를, 모르면 구독 목록을 연다. 스토어가 없는 플랫폼은 null이다 */
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
