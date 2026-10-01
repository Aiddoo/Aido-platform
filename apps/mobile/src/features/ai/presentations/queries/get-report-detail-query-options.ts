import { useAiService } from '@src/bootstrap/providers/di-context';
import type { AiService } from '@src/features/ai/services/ai.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys.constant';

export function getReportDetailQueryOptions(aiService: AiService, { id }: { id: number }) {
  return queryOptions({
    queryKey: AI_QUERY_KEYS.detail(id),
    queryFn: async ({ signal }) => {
      const result = await aiService.getReportById(id, signal);
      return unwrap(result);
    },
  });
}

export function useGetReportDetailQueryOptions(id: number) {
  return getReportDetailQueryOptions(useAiService(), { id });
}
