import { useMemoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { DEFAULT_PAGE_SIZE } from '@src/shared/constants/page-size';
import { type InfiniteData, infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import type { MemoPage } from '../domains/memo.model';
import { MEMO_QUERY_KEYS } from './memo-query-keys';

const FIRST_PAGE_CURSOR: number | undefined = undefined;

function selectMemos(data: InfiniteData<MemoPage>) {
  return data.pages.flatMap((page) => page.items);
}

export function useGetMemoQueryOptions({ memoId }: { memoId: number }) {
  const memoService = useMemoService();

  return queryOptions({
    queryKey: MEMO_QUERY_KEYS.detail({ memoId }),
    queryFn: async ({ signal }) => unwrap(await memoService.getMemo(memoId, signal)),
  });
}

export function useGetMemosInfiniteQueryOptions() {
  const memoService = useMemoService();

  return infiniteQueryOptions({
    queryKey: MEMO_QUERY_KEYS.list(),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await memoService.getMemos({ cursor: pageParam, size: DEFAULT_PAGE_SIZE }, signal)),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: ({ hasNext, nextCursor }) =>
      hasNext ? (nextCursor ?? undefined) : undefined,
    select: selectMemos,
  });
}

export function useGetMemoResourceLimitQueryOptions() {
  const memoService = useMemoService();

  return queryOptions({
    queryKey: MEMO_QUERY_KEYS.resourceLimit(),
    queryFn: async ({ signal }) => unwrap(await memoService.getResourceLimit(signal)),
    meta: { refreshOnPremiumChange: true },
  });
}
