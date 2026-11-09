import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import { subscriptionParamsSchema } from '../schemas/subscription-params.schema';

/** 구독 화면 URL 값. 보상 기간만 있는 사용자는 `view=plans`로, 막힌 기능에서 오면 `feature`를 달고 연다. 이 화면 안에서는 바꾸지 않는다 */
export function useSubscriptionParams() {
  const [params] = useRouteParams(subscriptionParamsSchema);

  return [params] as const;
}

/** 페이월에서 고른 요금제. 고르지 않았으면 undefined이고 기본 요금제는 SubscriptionPolicy.findSelectedPlan이 정한다 */
export function useSelectedPlanId() {
  const [{ plan: selectedPlanId }, setParams] = useRouteParams(subscriptionParamsSchema);
  const setSelectedPlanId = useCallback(
    (planId: string) => setParams({ plan: planId }),
    [setParams],
  );

  return [selectedPlanId, setSelectedPlanId] as const;
}
