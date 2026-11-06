import { useWhatsNewService } from '@src/bootstrap/providers/di-context';
import type { WhatsNewService } from '@src/features/app-config/whats-new/apis/whats-new.service';
import { queryOptions } from '@tanstack/react-query';

import { WHATS_NEW_QUERY_KEYS } from '../constants/whats-new-query-keys';

export function getWhatsNewQueryOptions(service: WhatsNewService) {
  return queryOptions({
    queryKey: WHATS_NEW_QUERY_KEYS.config(),
    queryFn: ({ signal }) => service.getConfig(signal),
    retry: false,
    staleTime: 0,
  });
}

export function useGetWhatsNewQueryOptions() {
  return getWhatsNewQueryOptions(useWhatsNewService());
}
