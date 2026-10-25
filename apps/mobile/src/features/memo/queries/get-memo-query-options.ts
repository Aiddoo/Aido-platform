import { useMemoService } from '@src/bootstrap/providers/di-context';
import type { MemoService } from '@src/features/memo/apis/memo.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys';

export function getMemoQueryOptions(service: MemoService, { memoId }: { memoId: number }) {
  return queryOptions({
    queryKey: MEMO_QUERY_KEYS.detail({ memoId }),
    queryFn: async ({ signal }) => {
      const result = await service.getMemo(memoId, signal);
      return unwrap(result);
    },
  });
}

export function useGetMemoQueryOptions({ memoId }: { memoId: number }) {
  return getMemoQueryOptions(useMemoService(), { memoId });
}
