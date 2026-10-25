import type { PlatformOSType } from 'react-native';
import { match } from 'ts-pattern';

const APP_STORE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
const PLAY_STORE_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';

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
export function createSubscriptionManagementUrl(
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
