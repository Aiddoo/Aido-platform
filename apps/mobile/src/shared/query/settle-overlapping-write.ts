import type { MutationKey, QueryClient, QueryKey } from '@tanstack/react-query';

import { isLastMutation } from './is-last-mutation';

interface SettleOverlappingWriteOptions {
  /** 같은 캐시를 쓰는 변경 묶음 */
  mutationKey: MutationKey;
  /** 응답이 고치는 조회 하나 */
  queryKey: QueryKey;
  /** 이 변경이 시작할 때 같은 묶음의 다른 변경이 진행 중이었는지(`onMutate`에서 센다) */
  startedWithOthers: boolean;
  /** 혼자 끝난 마지막 변경의 응답을 캐시에 쓴다 */
  writeResponse: () => void;
}

/**
 * 겹친 쓰기의 응답을 캐시에 반영한다. 응답이 오는 순서는 서버가 처리한 순서와 다를 수 있어 앞서 끝난 응답은 낡음만
 * 표시하고, 마지막 변경이 겹쳤으면(시작할 때 다른 변경이 있었거나 낡음 표시가 남음) 응답 대신 다시 받는다. `onSuccess`에서 부른다
 */
export function settleOverlappingWrite(
  queryClient: QueryClient,
  { mutationKey, queryKey, startedWithOthers, writeResponse }: SettleOverlappingWriteOptions,
): Promise<void> {
  if (!isLastMutation(queryClient, mutationKey)) {
    return queryClient.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
  }
  if (startedWithOthers || queryClient.getQueryState(queryKey)?.isInvalidated === true) {
    return queryClient.invalidateQueries({ queryKey, exact: true });
  }
  writeResponse();
  return Promise.resolve();
}
