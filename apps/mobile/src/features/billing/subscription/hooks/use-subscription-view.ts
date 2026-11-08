import { useView } from '@src/shared/hooks/use-view';

import { subscriptionViewSchema } from '../schemas/subscription-params.schema';

/** 구독 화면 보기 상태. 보상 기간만 있는 사용자가 요금제를 고를 때 `plans`로 연다. 이 화면 안에서는 바꾸지 않는다. */
export function useSubscriptionView() {
  const [view] = useView('view', subscriptionViewSchema);

  return [view] as const;
}
