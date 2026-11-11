import { mapInfiniteItems } from '@src/shared/domains/cursor-page.model';
import type { QueryClient } from '@tanstack/react-query';

import type { Memo } from '../domains/memo.model';
import { MEMO_QUERY_KEYS } from './memo-query-keys';

export function invalidateMemoList(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.list() });
}

export function invalidateMemoResourceLimit(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.resourceLimit() });
}

export function invalidateMemo(queryClient: QueryClient, { memoId }: { memoId: number }) {
  return queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId }) });
}

/**
 * 당겨서 새로고침과 다른 기능이 메모를 만들거나 지웠을 때의 새로고침 하나다. 목록과 개수 한도만 다시 읽는다.
 * 열린 메모 상세는 그 화면의 쿼리가 맡는다
 */
export function refreshMemos(queryClient: QueryClient) {
  return Promise.all([invalidateMemoList(queryClient), invalidateMemoResourceLimit(queryClient)]);
}

export function getCachedMemo(queryClient: QueryClient, { memoId }: { memoId: number }) {
  return queryClient.getQueryData(MEMO_QUERY_KEYS.detail({ memoId }));
}

/** 응답을 상세에 쓰고 쓰기 전 상세를 돌려준다. 늦게 끝난 조회가 응답을 덮지 않게 먼저 멈춘다 */
export async function setMemoDetailInCache(queryClient: QueryClient, memo: Memo) {
  await queryClient.cancelQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId: memo.id }) });
  const previous = getCachedMemo(queryClient, { memoId: memo.id });
  queryClient.setQueryData(MEMO_QUERY_KEYS.detail({ memoId: memo.id }), memo);
  return previous;
}

/** 저장 응답을 상세와 목록에 쓴다. 저장 전에 시작한 조회가 늦게 끝나 옛 글로 덮지 않게 먼저 멈춘다 */
export async function setMemoInCache(queryClient: QueryClient, memo: Memo) {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId: memo.id }) }),
    queryClient.cancelQueries({ queryKey: MEMO_QUERY_KEYS.list() }),
  ]);
  queryClient.setQueryData(MEMO_QUERY_KEYS.detail({ memoId: memo.id }), memo);
  replaceMemoInList(queryClient, memo);
}

export function replaceMemoInList(queryClient: QueryClient, memo: Memo) {
  queryClient.setQueryData(
    MEMO_QUERY_KEYS.list(),
    (data) => data && mapInfiniteItems(data, (item) => (item.id === memo.id ? memo : item)),
  );
}
