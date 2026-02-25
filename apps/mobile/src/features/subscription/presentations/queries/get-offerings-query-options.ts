import { useSubscriptionService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';
import { SUBSCRIPTION_QUERY_KEYS } from '../constants/subscription-query-keys.constant';

export const getOfferingsQueryOptions = () => {
  const subscriptionService = useSubscriptionService();

  return queryOptions({
    queryKey: SUBSCRIPTION_QUERY_KEYS.offerings(),
    queryFn: async () => {
      const result = await subscriptionService.getOfferings();
      return unwrap(result);
    },
    staleTime: 10 * 60 * 1000, // 10분
  });
};
