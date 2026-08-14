import type { FeatureDiscoveryResponse } from '@aido/validators';

import type { FeatureDiscoveryConfig } from '../models/feature-discovery.model';

export const toFeatureDiscoveryConfig = (
  response: FeatureDiscoveryResponse,
): FeatureDiscoveryConfig => {
  if (!response.enabled) {
    return { enabled: false };
  }

  return {
    ...response,
    launchedAt: new Date(response.launchedAt),
  };
};
