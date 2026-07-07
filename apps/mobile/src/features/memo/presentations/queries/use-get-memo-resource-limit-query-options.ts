import { useMemoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';
import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys.constant';

export const useGetMemoResourceLimitQueryOptions = () => {
  const service = useMemoService();

  return queryOptions({
    queryKey: MEMO_QUERY_KEYS.resourceLimit(),
    queryFn: async () => {
      const result = await service.getResourceLimit();
      return unwrap(result);
    },
  });
};
