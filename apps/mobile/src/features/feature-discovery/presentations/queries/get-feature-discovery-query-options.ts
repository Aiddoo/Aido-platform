import { useFeatureDiscoveryService } from '@src/bootstrap/providers/di-context';
import type { FeatureDiscoveryService } from '@src/features/feature-discovery/services/feature-discovery.service';
import { queryOptions } from '@tanstack/react-query';

import { FEATURE_DISCOVERY_QUERY_KEYS } from '../constants/feature-discovery-query-keys.constant';

export function getFeatureDiscoveryQueryOptions(service: FeatureDiscoveryService) {
  return queryOptions({
    queryKey: FEATURE_DISCOVERY_QUERY_KEYS.config(),
    queryFn: ({ signal }) => service.getConfig(signal),
    retry: false,
    staleTime: 0,
  });
}

export function useFeatureDiscoveryQueryOptions() {
  return getFeatureDiscoveryQueryOptions(useFeatureDiscoveryService());
}
