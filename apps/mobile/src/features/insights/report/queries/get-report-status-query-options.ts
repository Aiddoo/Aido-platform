import { useAiService } from '@src/bootstrap/providers/di-context';
import type { AiService } from '@src/features/ai/apis/ai.service';
import { AI_QUERY_KEYS } from '@src/features/ai/constants/ai-query-keys';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

export function getReportStatusQueryOptions(aiService: AiService) {
  return queryOptions({
    queryKey: AI_QUERY_KEYS.status(),
    queryFn: async ({ signal }) => {
      const result = await aiService.getReportStatus(signal);
      return unwrap(result);
    },
    meta: { refreshOnPremiumChange: true },
  });
}

export function useGetReportStatusQueryOptions() {
  return getReportStatusQueryOptions(useAiService());
}
