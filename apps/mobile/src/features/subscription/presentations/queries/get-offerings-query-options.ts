import { useSubscriptionService } from '@src/bootstrap/providers/di-context';
import type { SubscriptionService } from '@src/features/subscription/services/subscription.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { SUBSCRIPTION_QUERY_KEYS } from '../constants/subscription-query-keys.constant';

export function getOfferingsQueryOptions(subscriptionService: SubscriptionService) {
  return queryOptions({
    queryKey: SUBSCRIPTION_QUERY_KEYS.offerings(),
    queryFn: async () => {
      const result = await subscriptionService.getOfferings();
      return unwrap(result);
    },
    staleTime: 10 * 60 * 1000, // 10분
  });
}

export function useGetOfferingsQueryOptions() {
  return getOfferingsQueryOptions(useSubscriptionService());
}
