type Listener<TEvent> = (event: TEvent) => void;

/**
 * 캐시마다 구독자를 둔다. 캐시가 사라지면 함께 사라지고 구독을 풀면 빠진다.
 * 캐시 `onError`는 DI 밖에서 만들어져 토스트·보고 포트를 모르므로, Provider 안의 구독자에게 실패를 넘긴다
 */
export function createCacheListeners<TCache extends object, TEvent>() {
  const listenersByCache = new WeakMap<TCache, Set<Listener<TEvent>>>();

  return {
    notify: (cache: TCache, event: TEvent) => {
      for (const listener of listenersByCache.get(cache) ?? []) {
        listener(event);
      }
    },
    /** 해제 함수를 돌려준다 */
    subscribe: (cache: TCache, listener: Listener<TEvent>) => {
      const listeners = listenersByCache.get(cache) ?? new Set<Listener<TEvent>>();
      listenersByCache.set(cache, listeners);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
