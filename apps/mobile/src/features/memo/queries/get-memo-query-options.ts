import { useMemoService } from '@src/bootstrap/providers/di-context';
import type { MemoService } from '@src/features/memo/apis/memo.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys';

export function getMemoQueryOptions(service: MemoService, { id }: { id: number }) {
  return queryOptions({
    queryKey: MEMO_QUERY_KEYS.detail({ memoId: id }),
    queryFn: async ({ signal }) => {
      const result = await service.getMemo(id, signal);
      return unwrap(result);
    },
  });
}

export function useGetMemoQueryOptions({ id }: { id: number }) {
  return getMemoQueryOptions(useMemoService(), { id });
}
