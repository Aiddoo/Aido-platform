import { mapInfiniteItems } from '@src/shared/query/cursor-page';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import type { QueryClient } from '@tanstack/react-query';

import type { Memo } from '../domains/memo.model';
import { MEMO_MUTATION_KEYS } from './memo-mutation-keys';
import { MEMO_QUERY_KEYS } from './memo-query-keys';

export function invalidateMemoList(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.list() });
}

export function invalidateMemoResourceLimit(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.resourceLimit() });
}

/** 보고 있는 상세는 버리면 다시 받다 경계로 내려가므로 화면을 떠날 때까지 두고 다시 받지도 않는다 */
export function removeMemo(queryClient: QueryClient, { memoId }: { memoId: number }) {
  queryClient.removeQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId }), type: 'inactive' });
}

export function invalidateMemo(queryClient: QueryClient, { memoId }: { memoId: number }) {
  return queryClient.invalidateQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId }) });
}

/** 열린 메모 상세는 그 화면의 쿼리가 맡아 목록과 개수 한도만 다시 읽는다 */
export function refreshMemos(queryClient: QueryClient) {
  return Promise.all([invalidateMemoList(queryClient), invalidateMemoResourceLimit(queryClient)]);
}

export function getCachedMemo(queryClient: QueryClient, { memoId }: { memoId: number }) {
  return queryClient.getQueryData(MEMO_QUERY_KEYS.detail({ memoId }));
}

interface SettleMemoWriteOptions {
  startedWithOthers: boolean;
  /** 목록 항목도 응답으로 바꾸는지. 고정은 순서를 서버가 정해 목록을 다시 받는다 */
  isListItemReplaced: boolean;
}

/** 응답 순서는 서버 처리 순서와 다를 수 있어 겹친 쓰기는 앞선 응답을 낡음으로만 표시하고 마지막 쓰기 뒤 서버 값으로 맞춘다 */
export async function settleMemoWrite(
  queryClient: QueryClient,
  memo: Memo,
  { startedWithOthers, isListItemReplaced }: SettleMemoWriteOptions,
) {
  const detailKey = MEMO_QUERY_KEYS.detail({ memoId: memo.id });
  if (!isLastMutation(queryClient, MEMO_MUTATION_KEYS.writes({ memoId: memo.id }))) {
    await queryClient.invalidateQueries({ queryKey: detailKey, refetchType: 'none' });
    return;
  }
  const hasOverlapped =
    startedWithOthers || queryClient.getQueryState(detailKey)?.isInvalidated === true;
  // 쓰기 전에 시작한 조회가 늦게 끝나 옛 값으로 덮지 않게 먼저 멈춘다
  await Promise.all([
    queryClient.cancelQueries({ queryKey: detailKey }),
    isListItemReplaced && queryClient.cancelQueries({ queryKey: MEMO_QUERY_KEYS.list() }),
  ]);
  queryClient.setQueryData(detailKey, memo);
  if (isListItemReplaced) {
    setMemoListItemInCache(queryClient, memo);
  }
  if (hasOverlapped) {
    await invalidateMemo(queryClient, { memoId: memo.id });
  }
}

export function setMemoListItemInCache(queryClient: QueryClient, memo: Memo) {
  queryClient.setQueryData(
    MEMO_QUERY_KEYS.list(),
    (data) => data && mapInfiniteItems(data, (item) => (item.id === memo.id ? memo : item)),
  );
}
