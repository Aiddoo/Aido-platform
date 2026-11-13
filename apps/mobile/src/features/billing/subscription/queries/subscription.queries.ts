import { useSubscriptionService } from '@src/bootstrap/providers/di-context';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { queryOptions } from '@tanstack/react-query';

import {
  type OfferingsAvailability,
  toOfferingsAvailability,
} from '../domains/subscription-failure.model';
import { SUBSCRIPTION_QUERY_KEYS } from './subscription-query-keys';

const OFFERINGS_STALE_TIME_MS = 10 * MINUTE_MS;

export function useGetOfferingsQueryOptions() {
  const subscriptionService = useSubscriptionService();

  return queryOptions({
    queryKey: SUBSCRIPTION_QUERY_KEYS.offerings(),
    queryFn: async (): Promise<OfferingsAvailability> =>
      toOfferingsAvailability(await subscriptionService.getOfferings()),
    // 스토어를 쓸 수 없던 결과는 다시 들어오면 새로 확인한다
    staleTime: (query) => (query.state.data?.status === 'available' ? OFFERINGS_STALE_TIME_MS : 0),
  });
}
