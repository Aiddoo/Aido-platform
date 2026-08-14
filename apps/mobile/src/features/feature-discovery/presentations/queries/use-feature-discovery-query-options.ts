import { useFeatureDiscoveryService } from '@src/bootstrap/providers/di-context';
import { queryOptions } from '@tanstack/react-query';

import { FEATURE_DISCOVERY_QUERY_KEYS } from '../constants/feature-discovery-query-keys.constant';

export const useFeatureDiscoveryQueryOptions = () => {
  const service = useFeatureDiscoveryService();

  return queryOptions({
    queryKey: FEATURE_DISCOVERY_QUERY_KEYS.config(),
    queryFn: service.getConfig,
    retry: false,
    staleTime: 0,
  });
};
