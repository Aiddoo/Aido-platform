import { useAiService } from '@src/bootstrap/providers/di-context';
import type { AiService } from '@src/features/ai/services/ai.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import type { GetAiReportsParams } from '../../models/ai.model';
import { AI_QUERY_KEYS } from '../constants/ai-query-keys.constant';

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
  });
}

export function useGetReportsQueryOptions(params?: GetAiReportsParams) {
  return getReportsQueryOptions(useAiService(), { params });
}
