import { useAiService } from '@src/bootstrap/providers/di-context';
import type { AiService } from '@src/features/ai/apis/ai.service';
import { AI_QUERY_KEYS } from '@src/features/ai/constants/ai-query-keys';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

export function getReportDetailQueryOptions(aiService: AiService, { id }: { id: number }) {
  return queryOptions({
    queryKey: AI_QUERY_KEYS.detail({ reportId: id }),
    queryFn: async ({ signal }) => {
      const result = await aiService.getReportById(id, signal);
      return unwrap(result);
    },
    meta: { refreshOnPremiumChange: true },
  });
}

export function useGetReportDetailQueryOptions({ id }: { id: number }) {
  return getReportDetailQueryOptions(useAiService(), { id });
}
