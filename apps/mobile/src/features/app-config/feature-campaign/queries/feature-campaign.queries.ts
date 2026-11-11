import { useFeatureCampaignService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { FEATURE_CAMPAIGN_QUERY_KEYS } from './feature-campaign-query-keys';

export function useGetFeatureCampaignConfigQueryOptions() {
  const featureCampaignService = useFeatureCampaignService();

  return queryOptions({
    queryKey: FEATURE_CAMPAIGN_QUERY_KEYS.config(),
    queryFn: async ({ signal }) => unwrap(await featureCampaignService.getConfig(signal)),
    retry: false,
    staleTime: 0,
  });
}
