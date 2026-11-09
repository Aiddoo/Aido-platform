import { queryOptions } from '@tanstack/react-query';

import type { FeatureCampaignConfig } from '../domains/feature-campaign.model';

export const FEATURE_CAMPAIGN_QUERY_KEYS = {
  all: ['feature-discovery'] as const,
  config: () =>
    queryOptions<FeatureCampaignConfig>({
      queryKey: [...FEATURE_CAMPAIGN_QUERY_KEYS.all, 'config'],
    }).queryKey,
} as const;
