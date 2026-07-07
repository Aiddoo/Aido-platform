import { useSubscriptionService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';
import { SUBSCRIPTION_QUERY_KEYS } from '../constants/subscription-query-keys.constant';

export const useGetOfferingsQueryOptions = () => {
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
