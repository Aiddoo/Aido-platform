import type { FeatureDiscoveryResponse } from '@aido/api';
import { pick } from 'es-toolkit';

import type { WhatsNewCampaignConfig } from '../domains/whats-new-campaign.model';

export function toWhatsNewCampaignConfig(
  response: FeatureDiscoveryResponse,
): WhatsNewCampaignConfig {
  if (!response.enabled) {
    return { enabled: false };
  }

  return pick(response, ['enabled', 'campaignId', 'minAppVersion', 'autoOpen']);
}
