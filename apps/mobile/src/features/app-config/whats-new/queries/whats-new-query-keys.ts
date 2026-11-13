import { queryOptions } from '@tanstack/react-query';

import type { WhatsNewCampaignConfig } from '../domains/whats-new-campaign.model';

export const WHATS_NEW_QUERY_KEYS = {
  all: ['whats-new'] as const,
  campaign: () =>
    queryOptions<WhatsNewCampaignConfig>({
      queryKey: [...WHATS_NEW_QUERY_KEYS.all, 'campaign'],
    }).queryKey,
} as const;
