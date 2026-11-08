import { queryOptions } from '@tanstack/react-query';

import type { FeatureCampaignConfig } from '../domains/feature-campaign.model';

export const FEATURE_CAMPAIGN_QUERY_KEYS = {
  all: ['feature-discovery'] as const,
  // 캐시를 직접 읽고 쓰는 키는 데이터 타입을 붙여 getQueryData·setQueryData가 타입을 안다
  config: () =>
    queryOptions<FeatureCampaignConfig>({
      queryKey: [...FEATURE_CAMPAIGN_QUERY_KEYS.all, 'config'],
    }).queryKey,
} as const;
