import { router, useLocalSearchParams } from 'expo-router';
import { useSyncExternalStore } from 'react';

/**
 * 공용 expo-router mock의 URL을 실제처럼 움직인다. `router.setParams`가 값을 바꾸면 param을 읽는 컴포넌트가 모두 다시 그려진다.
 * jest.setup의 resetExpoRouterMock이 테스트마다 되돌린다
 */
export function createRouteParamsFake(initial: Record<string, string> = {}) {
  let params = initial;
  const listeners = new Set<() => void>();
  jest.mocked(useLocalSearchParams).mockImplementation(() =>
    useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => params,
    ),
  );
  jest.mocked(router.setParams).mockImplementation((next) => {
    const nextParams = new Map(Object.entries(params));
    Object.entries(next ?? {}).forEach(([key, value]) => {
      if (typeof value === 'string') {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    });
    params = Object.fromEntries(nextParams);
    listeners.forEach((listener) => listener());
  });
}
