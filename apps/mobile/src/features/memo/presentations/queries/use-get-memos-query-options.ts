import { useMemoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { infiniteQueryOptions } from '@tanstack/react-query';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys.constant';

export const useGetMemosQueryOptions = () => {
  const service = useMemoService();

  return infiniteQueryOptions({
    queryKey: MEMO_QUERY_KEYS.list(),
    queryFn: async ({ pageParam }) => {
      const result = await service.getMemos({
        cursor: pageParam ?? undefined,
        size: 20,
      });
      return unwrap(result);
    },
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext ? lastPage.pagination.nextCursor : undefined,
  });
};
