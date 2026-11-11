import type { FeatureDiscoveryResponse } from '@aido/api';
import { pick } from 'es-toolkit';

import type { FeatureCampaignConfig } from '../domains/feature-campaign.model';

export function toFeatureCampaignConfig(response: FeatureDiscoveryResponse): FeatureCampaignConfig {
  if (!response.enabled) {
    return { enabled: false };
  }

  return pick(response, ['enabled', 'campaignId', 'minAppVersion', 'autoOpen']);
}
