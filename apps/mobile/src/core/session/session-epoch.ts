import type { TokenStore } from '@src/core/ports/token-store';

/**
 * 세션 세대. 토큰이 지워질 때마다 올라간다.
 * 끝난 세션이 낸 요청의 늦은 응답이 다음 세션의 토큰을 건드리지 못하게 비교한다.
 */
export interface SessionEpoch {
  current(): number;
  advance(): void;
}

export function createSessionEpoch(): SessionEpoch {
  let epoch = 0;
  return {
    current: () => epoch,
    advance: () => {
      epoch += 1;
    },
  };
}

/**
 * 계정이 바뀌려면 항상 `clear`를 지나므로 `clear`만 세대를 올린다.
 * 삭제가 실패해도 세션은 끝난 것이라 삭제보다 먼저 올린다. 갱신기의 `save`는 올리지 않는다.
 */
export function withSessionEpoch(store: TokenStore, epoch: SessionEpoch): TokenStore {
  return {
    ...store,
    clear: async () => {
      epoch.advance();
      await store.clear();
    },
  };
}
