import type { QueryClient } from '@tanstack/react-query';

import type { SessionQueryCache } from './session-cleanup.service';

export function createSessionQueryCache(queryClient: QueryClient): SessionQueryCache {
  return {
    // clear는 진행 중 콜백을 못 막아 비우지 않으면 끝난 세션의 롤백이 다음 계정의 캐시를 채운다
    abandonPendingMutations: () => {
      for (const mutation of queryClient.getMutationCache().getAll()) {
        if (mutation.state.status === 'pending') {
          mutation.setOptions({
            ...mutation.options,
            onMutate: undefined,
            onSuccess: undefined,
            onError: undefined,
            onSettled: undefined,
          });
        }
      }
    },
    clear: () => queryClient.clear(),
    clearQueries: () => queryClient.getQueryCache().clear(),
  };
}
