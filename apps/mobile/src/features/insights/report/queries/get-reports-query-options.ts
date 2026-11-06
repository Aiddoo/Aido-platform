import { useAiService } from '@src/bootstrap/providers/di-context';
import type { AiService } from '@src/features/ai/apis/ai.service';
import { AI_QUERY_KEYS } from '@src/features/ai/constants/ai-query-keys';
import type { GetAiReportsParams } from '@src/features/ai/domains/ai.model';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

export function getReportsQueryOptions(
  aiService: AiService,
  { params }: { params?: GetAiReportsParams },
) {
  return queryOptions({
    queryKey: AI_QUERY_KEYS.list(params),
    queryFn: async ({ signal }) => {
      const result = await aiService.getReports(params, signal);
      return unwrap(result);
    },
    meta: { refreshOnPremiumChange: true },
  });
}

export function useGetReportsQueryOptions(params?: GetAiReportsParams) {
  return getReportsQueryOptions(useAiService(), { params });
}
