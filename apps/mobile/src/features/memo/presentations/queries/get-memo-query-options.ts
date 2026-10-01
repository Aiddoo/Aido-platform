import { useMemoService } from '@src/bootstrap/providers/di-context';
import type { MemoService } from '@src/features/memo/services/memo.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys.constant';

export function getMemoQueryOptions(service: MemoService, { id }: { id: number }) {
  return queryOptions({
    queryKey: MEMO_QUERY_KEYS.detail(id),
    queryFn: async ({ signal }) => {
      const result = await service.getMemo(id, signal);
      return unwrap(result);
    },
  });
}

export function useGetMemoQueryOptions(id: number) {
  return getMemoQueryOptions(useMemoService(), { id });
}
