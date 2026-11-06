import { useFeatureCampaignService } from '@src/bootstrap/providers/di-context';
import { queryOptions } from '@tanstack/react-query';

import { FEATURE_CAMPAIGN_QUERY_KEYS } from '../constants/feature-campaign-query-keys';

export function useGetFeatureCampaignConfigQueryOptions() {
  const featureCampaignService = useFeatureCampaignService();

  return queryOptions({
    queryKey: FEATURE_CAMPAIGN_QUERY_KEYS.config(),
    queryFn: ({ signal }) => featureCampaignService.getConfig(signal),
    retry: false,
    staleTime: 0,
  });
}
