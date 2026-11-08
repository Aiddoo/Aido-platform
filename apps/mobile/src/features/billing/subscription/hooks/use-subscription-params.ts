import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { subscriptionParamsSchema } from '../schemas/subscription-params.schema';

/** 구독 화면 URL 값. 보상 기간만 있는 사용자는 `view=plans`로, 막힌 기능에서 오면 `feature`를 달고 연다. 이 화면 안에서는 바꾸지 않는다 */
export function useSubscriptionParams() {
  const [params] = useRouteParams(subscriptionParamsSchema);

  return [params] as const;
}
