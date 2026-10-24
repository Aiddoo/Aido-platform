import type { QueryClient } from '@tanstack/react-query';

import { FEATURE_DISCOVERY_QUERY_KEYS } from '../constants/feature-discovery-query-keys';
import type { FeatureDiscoveryConfig } from '../domains/feature-discovery.model';

export function getCachedFeatureDiscoveryConfig(
  queryClient: QueryClient,
): FeatureDiscoveryConfig | undefined {
  return queryClient.getQueryData<FeatureDiscoveryConfig>(FEATURE_DISCOVERY_QUERY_KEYS.config());
}
