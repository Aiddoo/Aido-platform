import type { QueryClient } from '@tanstack/react-query';

import { FEATURE_CAMPAIGN_QUERY_KEYS } from '../constants/feature-campaign-query-keys';
import type { FeatureCampaignConfig } from '../schemas/feature-campaign.schema';

export function getCachedFeatureCampaignConfig(
  queryClient: QueryClient,
): FeatureCampaignConfig | undefined {
  return queryClient.getQueryData<FeatureCampaignConfig>(FEATURE_CAMPAIGN_QUERY_KEYS.config());
}
