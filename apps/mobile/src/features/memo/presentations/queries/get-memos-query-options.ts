import { useMemoService } from '@src/bootstrap/providers/di-context';
import type { MemoService } from '@src/features/memo/services/memo.service';
import { unwrap } from '@src/shared/errors/result';
import { infiniteQueryOptions } from '@tanstack/react-query';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys.constant';

export function getMemosQueryOptions(service: MemoService) {
  return infiniteQueryOptions({
    queryKey: MEMO_QUERY_KEYS.list(),
    queryFn: async ({ pageParam, signal }) => {
      const result = await service.getMemos(
        {
          cursor: pageParam ?? undefined,
          size: 20,
        },
        signal,
      );
      return unwrap(result);
    },
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? (lastPage.nextCursor ?? undefined) : undefined,
  });
}

export function useGetMemosQueryOptions() {
  return getMemosQueryOptions(useMemoService());
}
