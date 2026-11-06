import type { FeatureDiscoveryResponse } from '@aido/api';
import { toInstant } from '@src/shared/date/instant';

import type { FeatureCampaignConfig } from '../schemas/feature-campaign.schema';

export function toFeatureCampaignConfig(response: FeatureDiscoveryResponse): FeatureCampaignConfig {
  if (!response.enabled) {
    return { enabled: false };
  }

  return {
    ...response,
    launchedAt: toInstant(response.launchedAt),
  };
}
