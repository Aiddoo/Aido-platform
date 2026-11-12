import { mapInfiniteItems } from '@src/shared/domains/cursor-page.model';
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

/**
 * 지운 메모의 상세는 다시 받아도 없어 버린다. 보고 있는 상세는 버리면 다시 받다 경계로 내려가므로
 * 화면을 떠날 때까지 두고 다시 받지도 않는다
 */
export function removeMemo(queryClient: QueryClient, { memoId }: { memoId: number }) {
  queryClient.removeQueries({ queryKey: MEMO_QUERY_KEYS.detail({ memoId }), type: 'inactive' });
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

interface SettleMemoWriteOptions {
  /** 쓰기를 시작할 때 같은 메모의 다른 쓰기가 진행 중이었는지 */
  startedWithOthers: boolean;
  /** 목록 항목도 응답으로 바꾸는지. 고정은 순서를 서버가 정해 목록을 다시 받는다 */
  isListItemReplaced: boolean;
}

/**
 * 같은 메모의 수정·고정 응답을 쓴다. 응답이 오는 순서는 서버가 처리한 순서와 다를 수 있어, 겹친 쓰기는 앞서 끝난
 * 응답을 낡음으로만 표시하고 마지막 쓰기가 응답을 쓴 뒤 서버 값으로 다시 맞춘다. 쓰기 콜백 안에서 부른다
 */
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
    replaceMemoInList(queryClient, memo);
  }
  if (hasOverlapped) {
    await invalidateMemo(queryClient, { memoId: memo.id });
  }
}

export function replaceMemoInList(queryClient: QueryClient, memo: Memo) {
  queryClient.setQueryData(
    MEMO_QUERY_KEYS.list(),
    (data) => data && mapInfiniteItems(data, (item) => (item.id === memo.id ? memo : item)),
  );
}
