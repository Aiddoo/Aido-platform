import { useWhatsNewCampaignService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { WHATS_NEW_QUERY_KEYS } from './whats-new-query-keys';

export function useGetWhatsNewCampaignConfigQueryOptions() {
  const whatsNewCampaignService = useWhatsNewCampaignService();

  return queryOptions({
    queryKey: WHATS_NEW_QUERY_KEYS.campaign(),
    queryFn: async ({ signal }) => unwrap(await whatsNewCampaignService.getConfig(signal)),
    retry: false,
    staleTime: 0,
  });
}
