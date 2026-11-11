import type { QueryClient } from '@tanstack/react-query';

import type { SessionQueryCache } from './session-cleanup.service';

export function createSessionQueryCache(queryClient: QueryClient): SessionQueryCache {
  return {
    // clear는 진행 중 mutation 콜백을 막지 않아 비우지 않으면 끝난 세션의 롤백이 다음 계정 캐시를 채운다.
    // 전역 오류 피드백도 끄지 않으면 끝난 세션의 실패가 다음 화면에 토스트로 뜬다
    abandonPendingMutations: () => {
      // oxlint-disable-next-line aido/query-client-location -- 1.15.2 전환 #1400
      for (const mutation of queryClient.getMutationCache().getAll()) {
        if (mutation.state.status === 'pending') {
          mutation.setOptions({
            ...mutation.options,
            onMutate: undefined,
            onSuccess: undefined,
            onError: undefined,
            onSettled: undefined,
            meta: { ...mutation.options.meta, errorFeedback: false },
          });
        }
      }
    },
    // oxlint-disable-next-line aido/query-client-location -- 1.15.2 전환 #1400
    clear: () => queryClient.clear(),
    // oxlint-disable-next-line aido/query-client-location -- 1.15.2 전환 #1400
    clearQueries: () => queryClient.getQueryCache().clear(),
  };
}
