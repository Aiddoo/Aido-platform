import { useAiService } from '@src/bootstrap/providers/di-context';
import type { AiService } from '@src/features/ai/services/ai.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys.constant';

export function getReportStatusQueryOptions(aiService: AiService) {
  return queryOptions({
    queryKey: AI_QUERY_KEYS.status(),
    queryFn: async ({ signal }) => {
      const result = await aiService.getReportStatus(signal);
      return unwrap(result);
    },
  });
}

export function useGetReportStatusQueryOptions() {
  return getReportStatusQueryOptions(useAiService());
}
