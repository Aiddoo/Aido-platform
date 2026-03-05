import { useAiService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';
import { AI_QUERY_KEYS } from '../constants/ai-query-keys.constant';

export const useGetReportStatusQueryOptions = () => {
  const aiService = useAiService();

  return queryOptions({
    queryKey: AI_QUERY_KEYS.status(),
    queryFn: async () => {
      const result = await aiService.getReportStatus();
      return unwrap(result);
    },
  });
};
