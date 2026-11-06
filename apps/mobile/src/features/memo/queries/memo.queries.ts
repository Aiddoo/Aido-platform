import { useMemoService } from '@src/bootstrap/providers/di-context';
import { DEFAULT_PAGE_SIZE } from '@src/shared/constants/query.constants';
import { unwrap } from '@src/shared/errors/result';
import { type InfiniteData, infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys';
import type { MemoPage } from '../schemas/memo.schema';

const FIRST_PAGE_CURSOR: number | null = null;

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
