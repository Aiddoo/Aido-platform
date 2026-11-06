import type { QueryClient } from '@tanstack/react-query';

import { WHATS_NEW_QUERY_KEYS } from '../constants/whats-new-query-keys';
import type { WhatsNewConfig } from '../schemas/whats-new.schema';

export function getCachedWhatsNewConfig(queryClient: QueryClient): WhatsNewConfig | undefined {
  return queryClient.getQueryData<WhatsNewConfig>(WHATS_NEW_QUERY_KEYS.config());
}
