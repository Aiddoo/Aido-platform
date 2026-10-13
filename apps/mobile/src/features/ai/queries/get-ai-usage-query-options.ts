import { useAiService } from '@src/bootstrap/providers/di-context';
import type { AiService } from '@src/features/ai/apis/ai.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys';

export function getAiUsageQueryOptions(aiService: AiService) {
  return queryOptions({
    queryKey: AI_QUERY_KEYS.usage(),
    queryFn: async ({ signal }) => unwrap(await aiService.getAiUsage(signal)),
    staleTime: 60 * 1000,
  });
}

export function useGetAiUsageQueryOptions() {
  return getAiUsageQueryOptions(useAiService());
}
