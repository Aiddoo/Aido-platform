import { useAiService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { AI_QUERY_KEYS } from '../constants/ai-query-keys.constant';

export const useGetReportDetailQueryOptions = (id: number) => {
  const aiService = useAiService();

  return queryOptions({
    queryKey: AI_QUERY_KEYS.detail(id),
    queryFn: async () => {
      const result = await aiService.getReportById(id);
      return unwrap(result);
    },
  });
};
