import { match } from 'ts-pattern';

import {
  APP_STORE_SUBSCRIPTIONS_URL,
  PLAY_STORE_SUBSCRIPTIONS_URL,
} from '../constants/subscription.constants';

interface SubscriptionManagementTarget {
  productId: string | null;
  applicationId: string | null;
}

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
