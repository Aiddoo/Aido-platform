import { useMemoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';
import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys.constant';

export const useGetMemoQueryOptions = (id: number) => {
  const service = useMemoService();

  return queryOptions({
    queryKey: MEMO_QUERY_KEYS.detail(id),
    queryFn: async () => {
      const result = await service.getMemo(id);
      return unwrap(result);
    },
  });
};
