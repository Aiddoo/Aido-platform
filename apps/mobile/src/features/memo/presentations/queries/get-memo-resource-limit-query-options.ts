import { useMemoService } from '@src/bootstrap/providers/di-context';
import type { MemoService } from '@src/features/memo/services/memo.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys.constant';

export function getMemoResourceLimitQueryOptions(service: MemoService) {
  return queryOptions({
    queryKey: MEMO_QUERY_KEYS.resourceLimit(),
    queryFn: async ({ signal }) => {
      const result = await service.getResourceLimit(signal);
      return unwrap(result);
    },
  });
}

export function useGetMemoResourceLimitQueryOptions() {
  return getMemoResourceLimitQueryOptions(useMemoService());
}
