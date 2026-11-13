import { useMemoApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { DEFAULT_PAGE_SIZE } from '@src/shared/constants/page-size';
import { getNextCursor, selectPageItems } from '@src/shared/domains/cursor-page.model';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { MEMO_QUERY_KEYS } from './memo-query-keys';

const FIRST_PAGE_CURSOR: number | undefined = undefined;

export function useGetMemoQueryOptions({ memoId }: { memoId: number }) {
  const memoApi = useMemoApi();

  return queryOptions({
    queryKey: MEMO_QUERY_KEYS.detail({ memoId }),
    queryFn: async ({ signal }) => unwrap(await memoApi.getMemo(memoId, signal)),
  });
}

export function useGetMemosInfiniteQueryOptions() {
  const memoApi = useMemoApi();

  return infiniteQueryOptions({
    queryKey: MEMO_QUERY_KEYS.list(),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await memoApi.getMemos({ cursor: pageParam, size: DEFAULT_PAGE_SIZE }, signal)),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: getNextCursor,
    select: selectPageItems,
  });
}

export function useGetMemoResourceLimitQueryOptions() {
  const memoApi = useMemoApi();

  return queryOptions({
    queryKey: MEMO_QUERY_KEYS.resourceLimit(),
    queryFn: async ({ signal }) => unwrap(await memoApi.getResourceLimit(signal)),
    meta: { refreshOnPremiumChange: true },
  });
}
