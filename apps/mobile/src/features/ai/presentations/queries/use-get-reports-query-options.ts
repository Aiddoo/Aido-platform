import { useAiService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';
import type { GetAiReportsParams } from '../../models/ai.model';
import { AI_QUERY_KEYS } from '../constants/ai-query-keys.constant';

export const useGetReportsQueryOptions = (params?: GetAiReportsParams) => {
  const aiService = useAiService();

  return queryOptions({
    queryKey: AI_QUERY_KEYS.list(params),
    queryFn: async () => {
      const result = await aiService.getReports(params);
      return unwrap(result);
    },
  });
};
