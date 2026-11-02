import type { SubscriptionView } from '../../hooks/use-subscription-view-param';

/** 구독 화면(페이월·영수증)으로 가는 유일한 경로 */
export function subscriptionHref({ view }: { view?: SubscriptionView } = {}) {
  return view == null
    ? ({ pathname: '/settings/subscription' } as const)
    : ({ pathname: '/settings/subscription', params: { view } } as const);
}
