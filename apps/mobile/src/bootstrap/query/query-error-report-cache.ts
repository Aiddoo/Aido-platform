import { type Query, QueryCache } from '@tanstack/react-query';

import { createCacheListeners } from './cache-listeners';

const inlineErrorListeners = createCacheListeners<QueryCache, unknown>();

/**
 * 경계가 받을 실패인지. `useSuspenseQuery`는 옵션에 `suspense: true`를 싣고, 데이터가 없을 때만 던진다
 * (TanStack `defaultThrowOnError`). 데이터가 있는 재조회 실패는 화면이 옛 데이터를 보여 경계로 가지 않는다.
 * 처음 Suspense 조회는 observer가 붙기 전에 실패해 query 옵션으로 보고, 붙은 `useQuery`는 그 `throwOnError`로 본다.
 * query 옵션의 `suspense`는 공개 타입 밖이라 TanStack을 올리면 query-error-report.test가 지킨다
 */
function isThrownToBoundary(query: Query<unknown, unknown, unknown>, error: unknown): boolean {
  const { options } = query;
  const isSuspenseWithoutData =
    'suspense' in options &&
    options.suspense === true &&
    // oxlint-disable-next-line aido/no-strict-nullish -- null은 서버가 준 데이터다
    query.state.data === undefined;
  const isThrownByObserver = query.observers.some(({ options: { throwOnError } }) =>
    typeof throwOnError === 'function' ? throwOnError(error, query) : throwOnError === true,
  );

  return isSuspenseWithoutData || isThrownByObserver;
}

/** 앱의 조회 캐시. 경계 밖 조회(인라인 `useQuery`, 데이터가 있는 재조회)의 실패를 구독자에게 넘긴다 */
export function createAppQueryCache(): QueryCache {
  const cache: QueryCache = new QueryCache({
    onError: (error, query) => {
      if (!isThrownToBoundary(query, error)) {
        inlineErrorListeners.notify(cache, error);
      }
    },
  });
  return cache;
}

/** 해제 함수를 돌려준다. `createAppQueryCache`로 만들지 않은 캐시는 알리지 않는다 */
export function subscribeInlineQueryError(
  cache: QueryCache,
  listener: (error: unknown) => void,
): () => void {
  return inlineErrorListeners.subscribe(cache, listener);
}
